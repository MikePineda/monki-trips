import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'
import { actingAs } from '#tests/helpers/acting_as'
import { expectStatus } from '#tests/helpers/expect_status'
import { makeUser, TEST_PASSWORD } from '#tests/helpers/make_user'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { tokenFromMail, useRecordingMailer } from '#tests/helpers/recording_mailer'

const NEW_PASSWORD = 'a-brand-new-passphrase'

test.group('Password reset', (group) => {
  const mailer = useRecordingMailer(group)
  const clock = useFixedClock(group)
  group.each.setup(() => limiter.clear())

  const forgot = (client: any, email: string) =>
    client.post('/api/v1/auth/password/forgot').withCsrfToken().json({ email })
  const reset = (client: any, token: string, password = NEW_PASSWORD) =>
    client.post('/api/v1/auth/password/reset').withCsrfToken().json({ token, password })
  const login = (client: any, email: string, password: string) =>
    client.post('/api/v1/auth/login').withCsrfToken().json({ email, password })

  test('forgot answers 202 for known and unknown addresses alike', async ({ client, assert }) => {
    await makeUser({ email: 'owner@example.com' })

    const known = await forgot(client, 'owner@example.com')
    known.assertStatus(202)
    assert.equal(mailer.lastTo('owner@example.com').subject, 'Reset your monki trips password')

    const unknown = await forgot(client, 'nobody@example.com')
    unknown.assertStatus(202)
    assert.lengthOf(mailer.sent, 1)
  })

  test('password reset revokes every session', async ({ client, assert }) => {
    const user = await makeUser({ email: 'owner@example.com' })
    const phone = await login(client, 'owner@example.com', TEST_PASSWORD)
    phone.assertStatus(200)

    await forgot(client, 'owner@example.com')
    const token = tokenFromMail(mailer.lastTo('owner@example.com'))
    const response = await reset(client, token)
    response.assertStatus(204)

    const phoneAfter = await client.get('/api/v1/auth/me').withSession(phone.session())
    phoneAfter.assertStatus(401)

    await expectStatus(login(client, 'owner@example.com', TEST_PASSWORD), 401)
    await expectStatus(login(client, 'owner@example.com', NEW_PASSWORD), 200)
    await user.refresh()
    assert.equal(user.sessionVersion, 2)
  })

  test('a reset token works once', async ({ client }) => {
    await makeUser({ email: 'owner@example.com' })
    await forgot(client, 'owner@example.com')
    const token = tokenFromMail(mailer.lastTo('owner@example.com'))

    await expectStatus(reset(client, token), 204)
    const second = await reset(client, token, 'yet-another-passphrase')
    second.assertStatus(410)
    second.assertBodyContains({ code: 'E_TOKEN_EXPIRED' })
  })

  test('a reset token expires after sixty minutes', async ({ client }) => {
    await makeUser({ email: 'owner@example.com' })
    await forgot(client, 'owner@example.com')
    const token = tokenFromMail(mailer.lastTo('owner@example.com'))
    clock.advance(60 * 60_000)

    const response = await reset(client, token)
    response.assertStatus(410)
  })

  test('only the latest reset mail works', async ({ client }) => {
    await makeUser({ email: 'owner@example.com' })
    await forgot(client, 'owner@example.com')
    const first = tokenFromMail(mailer.lastTo('owner@example.com'))
    await forgot(client, 'owner@example.com')
    const second = tokenFromMail(mailer.lastTo('owner@example.com'))

    await expectStatus(reset(client, first), 410)
    await expectStatus(reset(client, second), 204)
  })

  test('a disabled account gets no reset mail', async ({ client, assert }) => {
    await makeUser({ email: 'gone@example.com', status: 'disabled' })

    await expectStatus(forgot(client, 'gone@example.com'), 202)
    assert.isEmpty(mailer.sent)
  })

  test('forgot is throttled per address', async ({ client }) => {
    await makeUser({ email: 'owner@example.com' })
    for (let i = 0; i < 5; i++) {
      await expectStatus(forgot(client, 'owner@example.com'), 202)
    }
    const blocked = await forgot(client, 'owner@example.com')
    blocked.assertStatus(429)
    blocked.assertBodyContains({ code: 'E_TOO_MANY_REQUESTS' })
    await expectStatus(forgot(client, 'other@example.com'), 202)
  })

  test('a signed-in person changes their password and keeps only this session', async ({
    client,
    assert,
  }) => {
    const user = await makeUser({ email: 'owner@example.com' })
    const phone = await login(client, 'owner@example.com', TEST_PASSWORD)

    const wrong = await actingAs(client.put('/api/v1/me/password'), user).json({
      currentPassword: 'not-it',
      password: NEW_PASSWORD,
    })
    wrong.assertStatus(403)
    wrong.assertBodyContains({ code: 'E_INVALID_PASSWORD' })

    const change = await actingAs(client.put('/api/v1/me/password'), user).json({
      currentPassword: TEST_PASSWORD,
      password: NEW_PASSWORD,
    })
    change.assertStatus(204)

    await expectStatus(client.get('/api/v1/auth/me').withSession(change.session()), 200)
    await expectStatus(client.get('/api/v1/auth/me').withSession(phone.session()), 401)
    await expectStatus(login(client, 'owner@example.com', NEW_PASSWORD), 200)
    await user.refresh()
    assert.equal(user.sessionVersion, 2)
  })
})
