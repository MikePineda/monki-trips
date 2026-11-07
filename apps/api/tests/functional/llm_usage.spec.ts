import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { PLANS } from '#config/plans'
import { ApiException } from '#exceptions/api_exception'
import { LlmClient } from '#services/llm/llm_client'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { useFakeLlm } from '#tests/helpers/fake_llm'

const chat = {
  purpose: 'chat' as const,
  system: 'You help with a trip.',
  messages: [{ role: 'user' as const, content: 'What is next?' }],
  maxTokens: 256,
}

/** Spends `tokens` for `userId` this month without calling anything. */
async function spend(userId: string, tokens: number, createdAt = '2026-11-05T10:00:00Z') {
  await db.table('llm_usage').insert({
    user_id: userId,
    purpose: 'chat',
    provider: 'fake',
    model: 'fake-chat-model',
    tokens_in: tokens,
    tokens_out: 0,
    status: 'ok',
    created_at: createdAt,
  })
}

/** Sets the cap override for one test and puts the previous value back. */
function withCapOverride(value: number | undefined): () => void {
  const previous = env.get('LLM_MONTHLY_TOKEN_CAP_OVERRIDE')
  env.set('LLM_MONTHLY_TOKEN_CAP_OVERRIDE', value as number)
  return () => env.set('LLM_MONTHLY_TOKEN_CAP_OVERRIDE', previous as number)
}

test.group('LLM usage and cap', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))
  const llm = useFakeLlm(group)

  test('token cap blocks chat with 402', async ({ client, assert }) => {
    const user = await makeUser()
    const trip = await makeTrip(user)
    await spend(user.id, PLANS.free.llmMonthlyTokenCap)
    const llmClient = await app.container.make(LlmClient)

    const error = await llmClient.complete({ user, tripId: trip.id }, chat).then(
      () => null,
      (thrown) => thrown
    )

    assert.instanceOf(error, ApiException)
    assert.equal(error.status, 402)
    assert.equal(error.code, 'E_LLM_QUOTA_EXCEEDED')
    assert.deepEqual(error.payload, {
      used: PLANS.free.llmMonthlyTokenCap,
      cap: PLANS.free.llmMonthlyTokenCap,
      resetsOn: '2026-12-01',
    })
    assert.lengthOf(llm.current.calls, 0, 'the provider is never called over the cap')
    const [refused] = await db.from('llm_usage').where('status', 'quota_exceeded')
    assert.equal(refused.user_id, user.id)
    assert.equal(refused.purpose, 'chat')

    // Over HTTP the same answer carries the payload.
    const response = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/phrase-cards`),
      user
    ).json({
      language: 'ja',
    })
    response.assertStatus(402)
    response.assertBodyContains({
      code: 'E_LLM_QUOTA_EXCEEDED',
      used: PLANS.free.llmMonthlyTokenCap,
      cap: PLANS.free.llmMonthlyTokenCap,
      resetsOn: '2026-12-01',
    })
  })

  test('last month and other accounts do not count against the cap', async ({ assert }) => {
    const user = await makeUser()
    const other = await makeUser()
    await spend(user.id, PLANS.free.llmMonthlyTokenCap, '2026-10-31T23:59:59Z')
    await spend(other.id, PLANS.free.llmMonthlyTokenCap)
    const llmClient = await app.container.make(LlmClient)

    const completion = await llmClient.complete({ user, tripId: null }, chat)

    assert.equal(completion.content, 'Your next event is the night train.')
  })

  test('the cap override replaces the plan caps', async ({ assert, cleanup }) => {
    cleanup(withCapOverride(50))
    const pro = await makeUser({ plan: 'pro' })
    await spend(pro.id, 60)
    const llmClient = await app.container.make(LlmClient)

    await assert.rejects(
      () => llmClient.complete({ user: pro, tripId: null }, chat),
      /E_LLM_QUOTA_EXCEEDED/
    )
  })

  test('usage is logged for every call including failures', async ({ assert }) => {
    const user = await makeUser()
    const trip = await makeTrip(user)
    const llmClient = await app.container.make(LlmClient)

    await llmClient.complete({ user, tripId: trip.id }, chat)
    for await (const delta of llmClient.stream({ user, tripId: trip.id }, chat)) {
      assert.isDefined(delta)
    }
    llm.current.useCase('chat', 'no-such-case')
    const failure = await llmClient.complete({ user, tripId: trip.id }, chat).then(
      () => null,
      (thrown) => thrown
    )

    assert.equal(failure?.code, 'E_LLM_UNAVAILABLE')
    assert.equal(failure?.status, 503)
    const rows = await db.from('llm_usage').where('user_id', user.id).orderBy('created_at')
    assert.lengthOf(rows, 3)
    assert.deepEqual(
      rows.map((row) => [row.purpose, row.provider, row.status, row.trip_id]),
      [
        ['chat', 'fake', 'ok', trip.id],
        ['chat', 'fake', 'ok', trip.id],
        ['chat', 'fake', 'error', trip.id],
      ]
    )
    assert.deepEqual(
      [rows[0].tokens_in, rows[0].tokens_out, rows[0].model],
      [300, 20, 'fake-chat-model']
    )
    assert.isNumber(rows[0].latency_ms)
    assert.deepEqual([rows[2].tokens_in, rows[2].tokens_out], [0, 0])
    // No price for the fake model: cost stays unknown instead of zero.
    assert.isNull(rows[0].cost_micros)
  })

  test('a priced model stores its cost in micro-dollars', async ({ assert }) => {
    const user = await makeUser()
    llm.current.script('chat', 'priced', {
      model: 'claude-haiku-5-5',
      responses: [{ content: 'ok', usage: { inputTokens: 1000, outputTokens: 1000 } }],
    })
    const llmClient = await app.container.make(LlmClient)

    await llmClient.complete({ user, tripId: null }, chat)

    const [row] = await db.from('llm_usage').where('user_id', user.id)
    // 1000 × 0.10 + 1000 × 0.50 micro-dollars
    assert.equal(Number(row.cost_micros), 600)
  })

  test('auth me exposes the tokens left this month', async ({ client }) => {
    const user = await makeUser({ plan: 'free' })
    await spend(user.id, 1_500)

    const response = await actingAs(client.get('/api/v1/auth/me'), user)

    response.assertStatus(200)
    response.assertBodyContains({
      data: { id: user.id, llmTokensLeft: PLANS.free.llmMonthlyTokenCap - 1_500 },
    })
  })

  test('llm usage prints totals per account without e-mail addresses', async ({ assert }) => {
    ace.ui.switchMode('raw')
    try {
      const user = await makeUser({ email: 'traveller@example.com' })
      await spend(user.id, 1_234)
      await spend(user.id, 100, '2026-10-15T10:00:00Z')

      const current = await ace.exec('llm:usage', [])
      const october = await ace.exec('llm:usage', ['--month', '2026-10'])
      const bad = await ace.exec('llm:usage', ['--month', 'october'])

      current.assertSucceeded()
      october.assertSucceeded()
      bad.assertFailed()
      const output = [
        ...current.logger.getLogs().map((log) => log.message),
        ...current.ui.logger.getLogs().map((log) => log.message),
      ].join('\n')
      assert.include(output, user.id)
      assert.include(output, 't***@example.com')
      assert.include(output, '1234')
      assert.notInclude(output, 'traveller@example.com')
      const octoberOutput = october.ui.logger
        .getLogs()
        .map((log) => log.message)
        .join('\n')
      assert.include(octoberOutput, '100')
    } finally {
      ace.ui.switchMode('normal')
    }
  })
})
