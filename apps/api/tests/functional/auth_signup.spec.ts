import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { RegistrationPolicy } from '#services/registration_policy'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser, TEST_PASSWORD } from '#tests/helpers/make_user'
import { makeInvitation, makeTrip } from '#tests/helpers/make_trip'
import { useRecordingMailer } from '#tests/helpers/recording_mailer'

class ClosedRegistration extends RegistrationPolicy {
  override isOpen() {
    return false
  }
}

const SIGNUP = {
  email: 'newcomer@example.com',
  password: TEST_PASSWORD,
  displayName: 'Newcomer',
}

test.group('Signup', (group) => {
  const mailer = useRecordingMailer(group)

  group.each.setup(() => {
    app.container.swap(RegistrationPolicy, () => new ClosedRegistration())
    return () => app.container.restore(RegistrationPolicy)
  })

  test('signup is refused while registration is closed', async ({ client, db }) => {
    const response = await client.post('/api/v1/auth/signup').withCsrfToken().json(SIGNUP)

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_REGISTRATION_CLOSED' })
    await db.assertMissing('users', { email: SIGNUP.email })
  })

  test('invited email can sign up while registration is closed', async ({ client, db, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const { invitation, token } = await makeInvitation(trip, owner, { email: SIGNUP.email })

    const response = await client
      .post('/api/v1/auth/signup')
      .withCsrfToken()
      .json({ ...SIGNUP, invitationToken: token })

    response.assertStatus(201)
    const profile = response.body().data
    assert.equal(profile.email, SIGNUP.email)
    assert.isNotNull(profile.emailVerifiedAt, 'an invitation to this address proves it')
    await db.assertHas('trip_members', { trip_id: trip.id, user_id: profile.id, role: 'editor' })
    await db.assertHas('travellers', { trip_id: trip.id, user_id: profile.id })
    await db.assertHas('trip_invitations', { id: invitation.id, accepted_by: profile.id })
    assert.isEmpty(mailer.sent, 'no verification mail for an address the invitation proved')

    const me = await client.get('/api/v1/auth/me').withSession(response.session())
    me.assertStatus(200)
  })

  test('inviter cannot sign up as the invited address', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const invite = (body: object) =>
      actingAs(client.post(`/api/v1/trips/${trip.id}/invitations`), owner).json(body)

    // The e-mail invitation's token goes to the inbox only.
    const byMail = await invite({ email: SIGNUP.email })
    byMail.assertStatus(201)
    assert.notProperty(byMail.body().data, 'token')

    // A link invitation the owner holds lets them in, but proves no address.
    const byLink = await invite({})
    const response = await client
      .post('/api/v1/auth/signup')
      .withCsrfToken()
      .json({ ...SIGNUP, invitationToken: byLink.body().data.token })

    response.assertStatus(201)
    assert.isNull(response.body().data.emailVerifiedAt)
    const verification = mailer.lastTo(SIGNUP.email)
    assert.equal(verification.subject, 'Confirm your e-mail for monki trips')
  })

  test('a link invitation lets someone sign up but their address still needs verifying', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const { token } = await makeInvitation(trip, owner)

    const response = await client
      .post('/api/v1/auth/signup')
      .withCsrfToken()
      .json({ ...SIGNUP, invitationToken: token })

    response.assertStatus(201)
    assert.isNull(response.body().data.emailVerifiedAt)
    assert.equal(mailer.lastTo(SIGNUP.email).subject, 'Confirm your e-mail for monki trips')
  })

  test('an invitation sent to another address is refused', async ({ client }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const { token } = await makeInvitation(trip, owner, { email: 'partner@example.com' })

    const response = await client
      .post('/api/v1/auth/signup')
      .withCsrfToken()
      .json({ ...SIGNUP, invitationToken: token })

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_INVITATION_EMAIL_MISMATCH' })
  })

  test('an unknown or used invitation answers 410', async ({ client }) => {
    const unknown = await client
      .post('/api/v1/auth/signup')
      .withCsrfToken()
      .json({ ...SIGNUP, invitationToken: 'not-a-real-token-at-all-0123456789' })
    unknown.assertStatus(410)
    unknown.assertBodyContains({ code: 'E_INVITATION_EXPIRED' })
  })
})

test.group('Signup with registration open', (group) => {
  const mailer = useRecordingMailer(group)

  test('creates an unverified account, signs it in and mails a link and a code', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/api/v1/auth/signup')
      .withCsrfToken()
      .header('Accept-Language', 'es')
      .json(SIGNUP)

    response.assertStatus(201)
    const profile = response.body().data
    assert.isNull(profile.emailVerifiedAt)
    assert.equal(profile.locale, 'es', 'the first locale follows Accept-Language')
    assert.notProperty(profile, 'password')
    const mail = mailer.lastTo(SIGNUP.email)
    assert.equal(mail.subject, 'Confirma tu correo para monki trips')
    assert.match(mail.text, /verify-email\?token=/)
    assert.match(mail.text, /\b\d{6}\b/)
  })

  test('a taken e-mail answers 409 whatever its case', async ({ client }) => {
    await makeUser({ email: 'taken@example.com' })

    const response = await client
      .post('/api/v1/auth/signup')
      .withCsrfToken()
      .json({ ...SIGNUP, email: 'Taken@Example.com' })

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_EMAIL_TAKEN' })
  })

  test('validation errors list field, rule and a translated message', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/api/v1/auth/signup')
      .withCsrfToken()
      .header('Accept-Language', 'es')
      .json({ email: 'nope', password: 'short', displayName: '' })

    response.assertStatus(422)
    const { errors } = response.body()
    assert.isArray(errors)
    const emailError = errors.find((e: { field: string }) => e.field === 'email')
    assert.equal(emailError.rule, 'email')
    assert.equal(emailError.message, 'el correo debe ser un correo válido')
    assert.exists(errors.find((e: { field: string; rule: string }) => e.field === 'password'))
  })

  test('mutating routes need the CSRF token', async ({ client }) => {
    const response = await client.post('/api/v1/auth/signup').json(SIGNUP)

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_BAD_CSRF_TOKEN' })
  })
})
