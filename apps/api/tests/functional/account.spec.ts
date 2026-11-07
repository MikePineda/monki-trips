import { test } from '@japa/runner'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser, TEST_PASSWORD } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'

test.group('Account', (group) => {
  const clock = useFixedClock(group)

  test('PATCH /me updates profile fields and nothing else', async ({ client, assert }) => {
    const user = await makeUser()

    const response = await actingAs(client.patch('/api/v1/me'), user).json({
      displayName: 'Renamed',
      locale: 'es',
      theme: 'dark',
      timezone: 'Australia/Sydney',
      email: 'sneaky@example.com',
      plan: 'pro',
    })

    response.assertStatus(200)
    assert.include(response.body().data, {
      displayName: 'Renamed',
      locale: 'es',
      theme: 'dark',
      timezone: 'Australia/Sydney',
      plan: 'free',
    })
    assert.equal(response.body().data.email, user.email)
  })

  test('an unknown time zone or theme is a validation error', async ({ client }) => {
    const user = await makeUser()

    const response = await actingAs(client.patch('/api/v1/me'), user).json({
      timezone: 'Mars/Olympus',
      theme: 'sepia',
    })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [{ field: 'timezone' }, { field: 'theme' }],
    })
  })

  test('GET /me/export returns the profile and one trip document per trip', async ({
    client,
    assert,
  }) => {
    const user = await makeUser({ displayName: 'Owner' })
    const partner = await makeUser({ displayName: 'Partner' })
    const owned = await makeTrip(user, { name: 'Owned' })
    const shared = await makeTrip(partner, { name: 'Shared' })
    await addMember(shared, user)
    const deleted = await makeTrip(user, { name: 'Deleted' })
    deleted.deletedAt = deleted.createdAt
    await deleted.save()

    const response = await actingAs(client.get('/api/v1/me/export'), user)

    response.assertStatus(200)
    assert.include(response.header('content-disposition'), 'attachment')
    const body = response.body().data
    assert.equal(body.schemaVersion, 1)
    assert.equal(body.exportedAt, '2026-11-07T10:00:00.000Z')
    assert.equal(body.profile.id, user.id)
    assert.sameMembers(
      body.trips.map((t: { trip: { name: string } }) => t.trip.name),
      ['Owned', 'Shared']
    )
    const ownedDocument = body.trips.find((t: { trip: { id: string } }) => t.trip.id === owned.id)
    assert.deepEqual(ownedDocument.members, [{ role: 'owner', displayName: 'Owner' }])
    assert.lengthOf(ownedDocument.travellers, 1)
    assert.notInclude(JSON.stringify(body.trips), user.id)
  })

  test('deleting an account with a shared owned trip answers 409', async ({ client, assert }) => {
    const user = await makeUser()
    const partner = await makeUser()
    const shared = await makeTrip(user, { name: 'Shared' })
    await addMember(shared, partner)
    await makeTrip(user, { name: 'Solo' })
    const edited = await makeTrip(partner, { name: 'Edited' })
    await addMember(edited, user)

    const response = await actingAs(client.post('/api/v1/me/delete'), user).json({
      password: TEST_PASSWORD,
    })

    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_SOLE_OWNER_OF_SHARED_TRIPS', tripIds: [shared.id] })
    await user.refresh()
    assert.isNull(user.deletionScheduledAt)
  })

  test('deleting an account needs the password', async ({ client }) => {
    const user = await makeUser()

    const response = await actingAs(client.post('/api/v1/me/delete'), user).json({
      password: 'not-it',
    })

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_INVALID_PASSWORD' })
  })

  test('deleting schedules the purge thirty days out, signs out everywhere and can be undone', async ({
    client,
    assert,
  }) => {
    const user = await makeUser()
    await makeTrip(user, { name: 'Solo' })
    const versionBefore = user.sessionVersion

    const response = await actingAs(client.post('/api/v1/me/delete'), user).json({
      password: TEST_PASSWORD,
    })

    response.assertStatus(204)
    await user.refresh()
    assert.equal(user.deletionScheduledAt?.toISO(), '2026-12-07T10:00:00.000+00:00')
    assert.equal(user.sessionVersion, versionBefore + 1)
    const stale = await client
      .get('/api/v1/auth/me')
      .loginAs(user)
      .withSession({ auth_session_version: versionBefore })
    stale.assertStatus(401)

    // Signing in again during the grace period still works and shows the date.
    const login = await client
      .post('/api/v1/auth/login')
      .withCsrfToken()
      .json({ email: user.email, password: TEST_PASSWORD })
    login.assertStatus(200)
    assert.isNotNull(login.body().data.deletionScheduledAt)

    const restore = await actingAs(client.post('/api/v1/me/restore'), user)
    restore.assertStatus(200)
    assert.isNull(restore.body().data.deletionScheduledAt)

    const again = await actingAs(client.post('/api/v1/me/restore'), user)
    again.assertStatus(409)
    again.assertBodyContains({ code: 'E_DELETION_NOT_SCHEDULED' })
    clock.advance(1)
  })
})
