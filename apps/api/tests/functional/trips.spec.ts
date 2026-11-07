import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'

const NEW_TRIP = {
  name: 'Demo Loop',
  baseCurrency: 'aud',
  startsOn: '2027-01-20',
  endsOn: '2027-02-06',
  homeTz: 'Australia/Sydney',
  budgetTotalMinor: 1250000,
}

test.group('Trips', (group) => {
  useFixedClock(group)

  test('creating a trip makes the creator its owner and first traveller', async ({
    client,
    db,
    assert,
  }) => {
    const user = await makeUser({ displayName: 'Owner' })

    const response = await actingAs(client.post('/api/v1/trips'), user).json(NEW_TRIP)

    response.assertStatus(201)
    const trip = response.body().data
    assert.include(trip, {
      name: 'Demo Loop',
      baseCurrency: 'AUD',
      budgetMode: 'shared',
      budgetTotalMinor: 1250000,
      startsOn: '2027-01-20',
      endsOn: '2027-02-06',
      homeTz: 'Australia/Sydney',
      createdBy: user.id,
      deletedAt: null,
    })
    await db.assertHas('trip_members', { trip_id: trip.id, user_id: user.id, role: 'owner' })
    await db.assertHas('travellers', {
      trip_id: trip.id,
      user_id: user.id,
      display_name: 'Owner',
      position: 0,
    })
  })

  test('creating with a client id is idempotent for the same person', async ({
    client,
    db,
    assert,
  }) => {
    const user = await makeUser()
    const id = randomUUID()

    const first = await actingAs(client.post('/api/v1/trips'), user).json({ ...NEW_TRIP, id })
    const second = await actingAs(client.post('/api/v1/trips'), user).json({ ...NEW_TRIP, id })

    first.assertStatus(201)
    second.assertStatus(200)
    assert.equal(second.body().data.id, id)
    await db.assertCount('trips', 1)
  })

  test("a client id that belongs to someone else's trip answers 404", async ({ client, db }) => {
    const owner = await makeUser()
    const other = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(client.post('/api/v1/trips'), other).json({
      ...NEW_TRIP,
      id: trip.id,
    })

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
    await db.assertCount('trips', 1)
  })

  test('an end date before the start date is a validation error', async ({ client }) => {
    const user = await makeUser()

    const response = await actingAs(client.post('/api/v1/trips'), user)
      .header('Accept-Language', 'es')
      .json({ ...NEW_TRIP, endsOn: '2027-01-01' })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'endsOn',
          rule: 'afterOrEqual',
          message: 'La fecha de fin no puede ser anterior a la de inicio',
        },
      ],
    })
  })

  test('the list shows live trips with my role and the member count', async ({
    client,
    assert,
  }) => {
    const user = await makeUser()
    const partner = await makeUser()
    const owned = await makeTrip(user, { name: 'Owned' })
    const shared = await makeTrip(partner, { name: 'Shared' })
    await addMember(shared, user)
    await makeTrip(partner, { name: 'Not mine' })
    const deleted = await makeTrip(user, { name: 'Deleted' })
    deleted.deletedAt = deleted.createdAt
    await deleted.save()

    const response = await actingAs(client.get('/api/v1/trips'), user)

    response.assertStatus(200)
    const byName = Object.fromEntries(
      response.body().data.map((t: { name: string }) => [t.name, t])
    )
    assert.sameMembers(Object.keys(byName), ['Owned', 'Shared'])
    assert.include(byName.Owned, { id: owned.id, role: 'owner', memberCount: 1 })
    assert.include(byName.Shared, { id: shared.id, role: 'editor', memberCount: 2 })
  })

  test('the snapshot holds the trip, its members and its travellers', async ({
    client,
    assert,
  }) => {
    const user = await makeUser({ displayName: 'Owner' })
    const partner = await makeUser({ displayName: 'Partner' })
    const trip = await makeTrip(user)
    await addMember(trip, partner)

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/snapshot`), partner)

    response.assertStatus(200)
    const { data } = response.body()
    assert.equal(data.trip.id, trip.id)
    assert.deepEqual(
      data.members.map((m: { role: string; displayName: string }) => [m.role, m.displayName]),
      [
        ['owner', 'Owner'],
        ['editor', 'Partner'],
      ]
    )
    assert.sameMembers(
      data.travellers.map((t: { displayName: string }) => t.displayName),
      ['Owner', 'Partner']
    )
  })

  test('a trip I am not a member of answers 404, not 403', async ({ client }) => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/snapshot`), stranger)

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
  })

  test('a non-uuid trip id never reaches a handler', async ({ client }) => {
    const user = await makeUser()

    const response = await actingAs(client.get('/api/v1/trips/not-a-uuid/snapshot'), user)

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROUTE_NOT_FOUND' })
  })

  test('editor cannot delete trip', async ({ client, db }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)

    const response = await actingAs(client.delete(`/api/v1/trips/${trip.id}`), editor)

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_TRIP_ROLE' })
    await db.assertHas('trips', { id: trip.id, deleted_at: null })
  })

  test('the owner deletes a trip, which disappears for 30 days and can be restored', async ({
    client,
    db,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const destroy = await actingAs(client.delete(`/api/v1/trips/${trip.id}`), owner)
    destroy.assertStatus(204)
    await trip.refresh()
    assert.equal(trip.deletedAt?.toISO(), '2026-11-07T10:00:00.000+00:00')
    assert.equal(trip.purgeAfter?.toISO(), '2026-12-07T10:00:00.000+00:00')

    const snapshot = await actingAs(client.get(`/api/v1/trips/${trip.id}/snapshot`), owner)
    snapshot.assertStatus(404)
    const list = await actingAs(client.get('/api/v1/trips'), owner)
    assert.isEmpty(list.body().data)

    const restore = await actingAs(client.post(`/api/v1/trips/${trip.id}/restore`), owner)
    restore.assertStatus(200)
    assert.isNull(restore.body().data.deletedAt)
    await db.assertHas('trips', { id: trip.id, deleted_at: null, purge_after: null })
  })

  test('only the owner restores a trip', async ({ client }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    trip.deletedAt = trip.createdAt
    await trip.save()

    const response = await actingAs(client.post(`/api/v1/trips/${trip.id}/restore`), editor)

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_TRIP_ROLE' })
  })

  test('transfer ownership swaps roles', async ({ client, db, assert }) => {
    const owner = await makeUser()
    const partner = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, partner)

    const response = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/transfer-ownership`),
      owner
    ).json({ userId: partner.id })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((m: { userId: string; role: string }) => [m.userId, m.role]),
      [
        [partner.id, 'owner'],
        [owner.id, 'editor'],
      ]
    )
    await db.assertHas('trip_members', { trip_id: trip.id, user_id: partner.id, role: 'owner' })
    await db.assertHas('trip_members', { trip_id: trip.id, user_id: owner.id, role: 'editor' })

    const formerOwner = await actingAs(client.delete(`/api/v1/trips/${trip.id}`), owner)
    formerOwner.assertStatus(403)
  })

  test('ownership can only go to a live member, and only from the owner', async ({ client }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const stranger = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)

    const toStranger = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/transfer-ownership`),
      owner
    ).json({ userId: stranger.id })
    toStranger.assertStatus(404)
    toStranger.assertBodyContains({ code: 'E_NOT_A_MEMBER' })

    const byEditor = await actingAs(
      client.post(`/api/v1/trips/${trip.id}/transfer-ownership`),
      editor
    ).json({ userId: editor.id })
    byEditor.assertStatus(403)
  })
})
