import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'
import UserToken from '#models/user_token'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { codeFromMail, tokenFromMail, useRecordingMailer } from '#tests/helpers/recording_mailer'

test.group('E-mail verification', (group) => {
  const mailer = useRecordingMailer(group)
  const clock = useFixedClock(group)
  group.each.setup(() => limiter.clear())

  async function unverifiedWithMail(client: any) {
    const user = await makeUser({ email: 'fresh@example.com', emailVerifiedAt: null })
    const resend = await actingAs(client.post('/api/v1/auth/email/resend'), user)
    resend.assertStatus(202)
    return { user, mail: mailer.lastTo('fresh@example.com') }
  }

  test('unverified user gets 403 on trip routes', async ({ client }) => {
    const user = await makeUser({ emailVerifiedAt: null })

    const list = await actingAs(client.get('/api/v1/trips'), user)
    list.assertStatus(403)
    list.assertBodyContains({ code: 'E_EMAIL_NOT_VERIFIED' })

    const create = await actingAs(client.post('/api/v1/trips'), user).json({
      name: 'Demo Loop',
      baseCurrency: 'AUD',
      startsOn: '2027-01-20',
      endsOn: '2027-02-06',
    })
    create.assertStatus(403)

    const me = await actingAs(client.get('/api/v1/auth/me'), user)
    me.assertStatus(200)
  })

  test('the link in the mail verifies the address without a session', async ({
    client,
    assert,
  }) => {
    const { user, mail } = await unverifiedWithMail(client)

    const verify = await client
      .post('/api/v1/auth/email/verify')
      .withCsrfToken()
      .json({ token: tokenFromMail(mail) })

    verify.assertStatus(204)
    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)

    const again = await client
      .post('/api/v1/auth/email/verify')
      .withCsrfToken()
      .json({ token: tokenFromMail(mail) })
    again.assertStatus(410)
    again.assertBodyContains({ code: 'E_TOKEN_EXPIRED' })
  })

  test('the six-digit code verifies the signed-in person', async ({ client, assert }) => {
    const { user, mail } = await unverifiedWithMail(client)

    const verify = await actingAs(client.post('/api/v1/auth/email/verify-code'), user).json({
      code: codeFromMail(mail),
    })

    verify.assertStatus(200)
    assert.isNotNull(verify.body().data.emailVerifiedAt)
    const trips = await actingAs(client.get('/api/v1/trips'), user)
    trips.assertStatus(200)
  })

  test('a wrong code counts an attempt and the fifth one exhausts the token', async ({
    client,
  }) => {
    const { user, mail } = await unverifiedWithMail(client)
    const attempt = (code: string) =>
      actingAs(client.post('/api/v1/auth/email/verify-code'), user).json({ code })

    for (let i = 0; i < 4; i++) {
      const wrong = await attempt('000000')
      wrong.assertStatus(400)
      wrong.assertBodyContains({ code: 'E_INVALID_CODE' })
    }
    const fifth = await attempt('000000')
    fifth.assertStatus(410)
    fifth.assertBodyContains({ code: 'E_TOKEN_EXPIRED' })

    const rightButLate = await attempt(codeFromMail(mail))
    rightButLate.assertStatus(410)
  })

  test('parallel wrong codes never exceed the attempt cap', async ({ client, assert }) => {
    const { user, mail } = await unverifiedWithMail(client)
    const right = codeFromMail(mail)
    const wrongCode = right === '000000' ? '111111' : '000000'
    const attempt = () =>
      actingAs(client.post('/api/v1/auth/email/verify-code'), user)
        .json({ code: wrongCode })
        .catch((e) => e)

    const responses = await Promise.all(Array.from({ length: 8 }, attempt))

    const statuses = responses.map((response) => response.status())
    // Five guesses are allowed: four answer 400 and the fifth exhausts the token.
    assert.equal(statuses.filter((status) => status === 400).length, 4)
    assert.equal(statuses.filter((status) => status === 410).length, 4)
    const row = await UserToken.query()
      .where('user_id', user.id)
      .where('purpose', 'verify_email')
      .firstOrFail()
    assert.equal(row.attempts, 5)
    const late = await actingAs(client.post('/api/v1/auth/email/verify-code'), user).json({
      code: right,
    })
    late.assertStatus(410)
  })

  test('link and code expire after fifteen minutes', async ({ client }) => {
    const { user, mail } = await unverifiedWithMail(client)
    clock.advance(15 * 60_000)

    const link = await client
      .post('/api/v1/auth/email/verify')
      .withCsrfToken()
      .json({ token: tokenFromMail(mail) })
    link.assertStatus(410)

    const code = await actingAs(client.post('/api/v1/auth/email/verify-code'), user).json({
      code: codeFromMail(mail),
    })
    code.assertStatus(410)
  })

  test('resending invalidates the previous mail', async ({ client }) => {
    const { user, mail: first } = await unverifiedWithMail(client)
    const resend = await actingAs(client.post('/api/v1/auth/email/resend'), user)
    resend.assertStatus(202)
    const second = mailer.lastTo('fresh@example.com')

    const stale = await client
      .post('/api/v1/auth/email/verify')
      .withCsrfToken()
      .json({ token: tokenFromMail(first) })
    stale.assertStatus(410)

    const fresh = await client
      .post('/api/v1/auth/email/verify')
      .withCsrfToken()
      .json({ token: tokenFromMail(second) })
    fresh.assertStatus(204)
  })

  test('an already verified address cannot ask for another mail', async ({ client }) => {
    const user = await makeUser()

    const resend = await actingAs(client.post('/api/v1/auth/email/resend'), user)
    resend.assertStatus(409)
    resend.assertBodyContains({ code: 'E_EMAIL_ALREADY_VERIFIED' })
  })

  test('a verified person reaches the trip routes', async ({ client }) => {
    const user = await makeUser()
    await makeTrip(user)

    const list = await actingAs(client.get('/api/v1/trips'), user)
    list.assertStatus(200)
  })
})
