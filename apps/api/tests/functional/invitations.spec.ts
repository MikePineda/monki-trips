import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import TripInvitation from '#models/trip_invitation'
import { hashToken } from '#domain/secure_token'
import { actingAs } from '#tests/helpers/acting_as'
import { expectStatus } from '#tests/helpers/expect_status'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeInvitation, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { useRecordingMailer } from '#tests/helpers/recording_mailer'

/** The plaintext token of the `/invite/<token>` link in an invitation mail. */
function inviteTokenFromMail(text: string): string {
  const match = text.match(/\/invite\/([A-Za-z0-9_%-]+)/)
  if (!match) throw new Error('the mail carries no invitation link')
  return decodeURIComponent(match[1])
}

test.group('Invitations: owner side', (group) => {
  const mailer = useRecordingMailer(group)
  useFixedClock(group)

  test('the owner issues a link invitation; the token is shown once and stored hashed', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/invitations`),
      owner
    ).json({})

    response.assertStatus(201)
    const { invitation, token, url } = response.body().data
    assert.isString(token)
    assert.equal(url, `http://127.0.0.1:3333/invite/${encodeURIComponent(token)}`)
    assert.include(invitation, { role: 'editor', email: null, state: 'pending' })
    assert.equal(invitation.expiresAt, '2026-11-14T10:00:00.000+00:00')
    assert.notProperty(invitation, 'tokenHash')
    const row = await TripInvitation.findOrFail(invitation.id)
    assert.equal(row.tokenHash, hashToken(token))
    assert.notEqual(row.tokenHash, token)
    assert.isEmpty(mailer.sent)

    const list = await actingAs(client.get(`/api/v1/trips/${trip.id}/invitations`), owner)
    list.assertStatus(200)
    assert.lengthOf(list.body().data, 1)
    assert.notInclude(JSON.stringify(list.body()), token)
  })

  test('an e-mail invitation is mailed to the address with the link', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser({ displayName: 'Owner', locale: 'es' })
    const trip = await makeTrip(owner, { name: 'Demo Loop' })

    const response = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/invitations`),
      owner
    ).json({ email: 'Partner@Example.com' })

    response.assertStatus(201)
    assert.equal(response.body().data.invitation.email, 'partner@example.com')
    const mail = mailer.lastTo('partner@example.com')
    assert.equal(mail.subject, 'Demo Loop: te invitan a planear el viaje juntos')
    const token = inviteTokenFromMail(mail.text)
    assert.include(mail.text, `http://127.0.0.1:3333/invite/${encodeURIComponent(token)}`)
    const row = await TripInvitation.findOrFail(response.body().data.invitation.id)
    assert.equal(row.tokenHash, hashToken(token))
    assert.include(mail.text, 'Owner')
  })

  test('e-mail invitation response does not expose the token', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/invitations`),
      owner
    ).json({ email: 'partner@example.com' })

    response.assertStatus(201)
    const data = response.body().data
    assert.equal(data.delivery, 'email')
    assert.notProperty(data, 'token')
    assert.notProperty(data, 'url')
    const token = inviteTokenFromMail(mailer.lastTo('partner@example.com').text)
    assert.notInclude(JSON.stringify(response.body()), token)
  })

  test('link invitation returns its url once', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/invitations`),
      owner
    ).json({})

    response.assertStatus(201)
    const data = response.body().data
    assert.equal(data.delivery, 'link')
    assert.equal(data.url, `http://127.0.0.1:3333/invite/${encodeURIComponent(data.token)}`)
    const list = await actingAs(client.get(`/api/v1/trips/${trip.id}/invitations`), owner)
    assert.notInclude(JSON.stringify(list.body()), data.token)
    assert.isEmpty(mailer.sent)
  })

  test('editors cannot issue or list invitations', async ({ client }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)

    const create = await actingAs(client.post(`/api/v1/trips/${trip.id}/invitations`), editor).json(
      {}
    )
    create.assertStatus(403)
    create.assertBodyContains({ code: 'E_TRIP_ROLE' })

    const list = await actingAs(client.get(`/api/v1/trips/${trip.id}/invitations`), editor)
    list.assertStatus(403)
  })

  test('revoking an invitation makes it answer 410', async ({ client }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const { invitation, token } = await makeInvitation(trip, owner)

    const revoke = await actingAs(
      client.delete(`/api/v1/trips/${trip.id}/invitations/${invitation.id}`),
      owner
    )
    revoke.assertStatus(204)

    const preview = await client.get(`/api/v1/invitations/${token}`)
    preview.assertStatus(410)
    preview.assertBodyContains({ code: 'E_INVITATION_EXPIRED' })
  })
})

test.group('Invitations: invitee side', (group) => {
  useFixedClock(group)

  test('the public preview shows the trip name and role only', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner, { name: 'Demo Loop' })
    const { token } = await makeInvitation(trip, owner, { email: 'partner@example.com' })

    const response = await client.get(`/api/v1/invitations/${token}`)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, {
      tripName: 'Demo Loop',
      role: 'editor',
      requiresEmail: true,
    })
    assert.notInclude(JSON.stringify(response.body()), 'partner@example.com')
    assert.notInclude(JSON.stringify(response.body()), trip.id)
  })

  test('an unknown token answers 404', async ({ client }) => {
    const response = await client.get('/api/v1/invitations/definitely-not-a-token')

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
  })

  test('accepting an invitation creates member and traveller', async ({ client, db, assert }) => {
    const owner = await makeUser()
    const partner = await makeUser({ displayName: 'Partner' })
    const trip = await makeTrip(owner)
    const { invitation, token } = await makeInvitation(trip, owner)

    const response = await actingAs(client.post(`/api/v1/invitations/${token}/accept`), partner)

    response.assertStatus(201)
    assert.equal(response.body().data.id, trip.id)
    await db.assertHas('trip_members', { trip_id: trip.id, user_id: partner.id, role: 'editor' })
    await db.assertHas('travellers', {
      trip_id: trip.id,
      user_id: partner.id,
      display_name: 'Partner',
      position: 1,
    })
    await db.assertHas('trip_invitations', { id: invitation.id, accepted_by: partner.id })
    const snapshot = await actingAs(client.get(`/api/v1/trips/${trip.id}/snapshot`), partner)
    snapshot.assertStatus(200)
  })

  test('link invitation is single use', async ({ client, db }) => {
    const owner = await makeUser()
    const first = await makeUser()
    const second = await makeUser()
    const trip = await makeTrip(owner)
    const { token } = await makeInvitation(trip, owner)

    await expectStatus(actingAs(client.post(`/api/v1/invitations/${token}/accept`), first), 201)
    const again = await actingAs(client.post(`/api/v1/invitations/${token}/accept`), second)

    again.assertStatus(410)
    again.assertBodyContains({ code: 'E_INVITATION_EXPIRED' })
    await db.assertMissing('trip_members', { trip_id: trip.id, user_id: second.id })
  })

  test('expired invitation answers 410', async ({ client }) => {
    const owner = await makeUser()
    const partner = await makeUser()
    const trip = await makeTrip(owner)
    const { token } = await makeInvitation(trip, owner, {
      expiresAt: DateTime.fromISO('2026-11-07T10:00:00Z'),
    })

    const preview = await client.get(`/api/v1/invitations/${token}`)
    preview.assertStatus(410)
    const accept = await actingAs(client.post(`/api/v1/invitations/${token}/accept`), partner)
    accept.assertStatus(410)
    accept.assertBodyContains({ code: 'E_INVITATION_EXPIRED' })
  })

  test('an e-mail invitation must be accepted by that address, and verifies it', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const partner = await makeUser({ email: 'partner@example.com', emailVerifiedAt: null })
    const other = await makeUser()
    const trip = await makeTrip(owner)
    const { token } = await makeInvitation(trip, owner, { email: 'partner@example.com' })

    const wrong = await actingAs(client.post(`/api/v1/invitations/${token}/accept`), other)
    wrong.assertStatus(403)
    wrong.assertBodyContains({ code: 'E_INVITATION_EMAIL_MISMATCH' })

    const right = await actingAs(client.post(`/api/v1/invitations/${token}/accept`), partner)
    right.assertStatus(201)
    await partner.refresh()
    assert.isNotNull(partner.emailVerifiedAt)
  })

  test('a link invitation needs a verified address', async ({ client }) => {
    const owner = await makeUser()
    const unverified = await makeUser({ emailVerifiedAt: null })
    const trip = await makeTrip(owner)
    const { token } = await makeInvitation(trip, owner)

    const response = await actingAs(client.post(`/api/v1/invitations/${token}/accept`), unverified)

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_EMAIL_NOT_VERIFIED' })
  })

  test('accepting needs a session', async ({ client }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const { token } = await makeInvitation(trip, owner)

    const response = await client.post(`/api/v1/invitations/${token}/accept`).withCsrfToken()

    response.assertStatus(401)
  })

  test('a member who accepts a second invitation keeps one membership and one traveller', async ({
    client,
    db,
  }) => {
    const owner = await makeUser()
    const partner = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, partner)
    const { token } = await makeInvitation(trip, owner)

    const response = await actingAs(client.post(`/api/v1/invitations/${token}/accept`), partner)

    response.assertStatus(201)
    await db.assertHas('trip_members', { trip_id: trip.id, user_id: partner.id }, 1)
    await db.assertHas('travellers', { trip_id: trip.id, user_id: partner.id }, 1)
  })

  test('an invitation to a deleted trip answers 404', async ({ client }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const { token } = await makeInvitation(trip, owner)
    trip.deletedAt = trip.createdAt
    await trip.save()

    const response = await client.get(`/api/v1/invitations/${token}`)

    response.assertStatus(404)
  })
})
