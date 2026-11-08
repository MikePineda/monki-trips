import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { FakeLlmProvider } from '#services/llm/fake_llm_provider'
import { LlmUnavailableError, type LlmDelta } from '#services/llm/llm_provider'

const request = {
  purpose: 'chat' as const,
  system: 'You help with a trip.',
  messages: [{ role: 'user' as const, content: 'We spent 450 on dinner' }],
  maxTokens: 512,
}

async function collect(stream: AsyncIterable<LlmDelta>): Promise<LlmDelta[]> {
  const deltas: LlmDelta[] = []
  for await (const delta of stream) deltas.push(delta)
  return deltas
}

test.group('Fake LLM provider', () => {
  const fake = () => new FakeLlmProvider(app.makePath('tests/fixtures/llm'))

  test('fake provider streams tool calls', async ({ assert }) => {
    const provider = fake().useCase('chat', 'tool-call')

    const deltas = await collect(provider.stream(request))

    const text = deltas.filter((d) => d.type === 'text')
    assert.isAbove(text.length, 1, 'text arrives in more than one delta')
    assert.equal(
      text.map((d) => (d.type === 'text' ? d.text : '')).join(''),
      'Let me add that expense for you to confirm.'
    )
    const toolCalls = deltas.filter((d) => d.type === 'tool_call')
    assert.deepEqual(toolCalls, [
      {
        type: 'tool_call',
        toolCall: {
          id: 'toolu_fake_1',
          name: 'add_expense',
          input: { amountMinor: 45000, currency: 'AUD', category: 'food' },
        },
      },
    ])
    const done = deltas.at(-1)!
    assert.equal(done.type, 'done')
    if (done.type === 'done') {
      assert.equal(done.completion.stopReason, 'tool_use')
      assert.deepEqual(done.completion.usage, { inputTokens: 400, outputTokens: 60 })
      assert.equal(done.completion.model, 'fake-chat-model')
    }
  })

  test('answers the default case and records every request', async ({ assert }) => {
    const provider = fake()

    const completion = await provider.complete(request)

    assert.equal(completion.content, 'Your next event is the night train.')
    assert.deepEqual(completion.toolCalls, [])
    assert.lengthOf(provider.calls, 1)
    assert.equal(provider.calls[0].purpose, 'chat')
  })

  test('walks the scripted responses in order and repeats the last one', async ({ assert }) => {
    const provider = fake().script('chat', 'two-steps', {
      responses: [{ content: 'first' }, { content: 'second' }],
    })

    const answers = [
      await provider.complete(request),
      await provider.complete(request),
      await provider.complete(request),
    ]

    assert.deepEqual(
      answers.map((a) => a.content),
      ['first', 'second', 'second']
    )
  })

  test('a scripted error or a missing fixture fails like an outage', async ({ assert }) => {
    const outage = fake().useCase('phrase_cards', 'unavailable')
    const missing = fake().useCase('chat', 'no-such-case')

    await assert.rejects(
      () => outage.complete({ ...request, purpose: 'phrase_cards' }),
      LlmUnavailableError as any
    )
    await assert.rejects(() => missing.complete(request), LlmUnavailableError as any)
  })

  test('the fake offers vision until a test turns it off', ({ assert }) => {
    const provider = fake()

    assert.isTrue(provider.supportsVision)
    provider.withVision(false)
    assert.isFalse(provider.supportsVision)
  })
})
