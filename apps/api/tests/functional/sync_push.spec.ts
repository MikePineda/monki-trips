import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, push, pushApplied, pushOne } from '#tests/helpers/sync'

test.group('Sync push', (group) => {
  const clock = useFixedClock(group, new Date('2026-11-07T10:00:00Z'))

  test('an upsert creates the row, stamps the field clock and records the activity', async ({
    client,
    db: dbAssert,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const stop = mutation(trip.id, 'stop', { name: 'Harbour Town', countryCode: 'au', position: 1 })

    const result = await pushOne(client, owner, stop)

    assert.equal(result.status, 'applied')
    assert.include(result.row as object, {
      id: stop.id,
      tripId: trip.id,
      name: 'Harbour Town',
      countryCode: 'AU',
      position: 1,
      deletedAt: null,
    })
    const [row] = await db.from('stops').where('id', stop.id)
    assert.deepEqual(row.field_clock, {
      name: Date.parse(stop.changedAt),
      countryCode: Date.parse(stop.changedAt),
      position: Date.parse(stop.changedAt),
    })
    await dbAssert.assertHas('trip_activity', {
      trip_id: trip.id,
      actor_user_id: owner.id,
      entity: 'stop',
      entity_id: stop.id,
      action: 'created',
    })
    const [activity] = await db.from('trip_activity').where('entity_id', stop.id)
    assert.sameMembers(activity.fields, ['name', 'countryCode', 'position'])
    await dbAssert.assertHas('sync_mutations', { id: stop.mutationId, status: 'applied' })
  })

  test('replayed mutation returns stored result', async ({ client, db: dbAssert, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const stop = mutation(trip.id, 'stop', { name: 'Harbour Town' })

    const first = await pushOne(client, owner, stop)
    const replay = await pushOne(client, owner, { ...stop, changes: { name: 'Changed on replay' } })

    assert.equal(first.status, 'applied')
    assert.equal(replay.status, 'duplicate')
    assert.deepEqual(replay.row, first.row)
    await dbAssert.assertHas('stops', { id: stop.id, name: 'Harbour Town' })
    await dbAssert.assertCount('trip_activity', 1)
  })

  test('field level last write wins across two users', async ({ client, assert }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    const eventId = randomUUID()
    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'event',
        { kind: 'meal', title: 'Dinner', notes: 'Original' },
        { id: eventId, changedAt: '2026-11-07T09:00:00.000Z' }
      )
    )

    // The editor renamed it at 09:30 (offline), the owner changed the notes at 09:45.
    const ownerNotes = await pushOne(
      client,
      owner,
      mutation(
        trip.id,
        'event',
        { notes: 'Owner notes', title: 'Owner title' },
        { id: eventId, changedAt: '2026-11-07T09:45:00.000Z' }
      )
    )
    const editorLate = await pushOne(
      client,
      editor,
      mutation(
        trip.id,
        'event',
        { title: 'Editor title', notes: 'Editor notes' },
        { id: eventId, changedAt: '2026-11-07T09:30:00.000Z' }
      )
    )

    assert.equal(ownerNotes.status, 'applied')
    assert.equal(editorLate.status, 'partial')
    assert.sameMembers(editorLate.rejectedFields!, ['title', 'notes'])
    assert.include(editorLate.row as object, { title: 'Owner title', notes: 'Owner notes' })

    // A field nobody touched since still takes the older change.
    const editorPlace = await pushOne(
      client,
      editor,
      mutation(
        trip.id,
        'event',
        { placeName: 'Pier 9' },
        { id: eventId, changedAt: '2026-11-07T09:30:00.000Z' }
      )
    )
    assert.equal(editorPlace.status, 'applied')
    assert.include(editorPlace.row as object, { placeName: 'Pier 9', title: 'Owner title' })
  })

  test('changed at is clamped to the allowed window', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const stop = mutation(
      trip.id,
      'stop',
      { name: 'Future' },
      { changedAt: '2030-01-01T00:00:00.000Z' }
    )
    const old = mutation(
      trip.id,
      'stop',
      { name: 'Ancient' },
      { changedAt: '2020-01-01T00:00:00.000Z' }
    )

    await pushApplied(client, owner, stop)
    await pushApplied(client, owner, old)

    const now = clock.now().getTime()
    const [future] = await db.from('stops').where('id', stop.id)
    const [ancient] = await db.from('stops').where('id', old.id)
    assert.equal(future.field_clock.name, now)
    assert.equal(ancient.field_clock.name, now - 45 * 24 * 60 * 60 * 1000)
  })

  test('update after delete is rejected', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const stopId = randomUUID()
    await pushApplied(client, owner, mutation(trip.id, 'stop', { name: 'Gone' }, { id: stopId }))

    const deleted = await pushOne(
      client,
      owner,
      mutation(trip.id, 'stop', {}, { id: stopId, op: 'delete' })
    )
    const late = await pushOne(
      client,
      owner,
      mutation(
        trip.id,
        'stop',
        { name: 'Back again' },
        { id: stopId, changedAt: '2026-11-07T10:00:00.000Z' }
      )
    )

    assert.equal(deleted.status, 'applied')
    assert.isNotNull((deleted.row as { deletedAt: string | null }).deletedAt)
    assert.equal(late.status, 'rejected')
    assert.equal(late.error?.code, 'E_ROW_DELETED')
    assert.equal((late.row as { name: string }).name, 'Gone')
  })

  test('a non-member is told the trip does not exist and writes nothing', async ({
    client,
    db: dbAssert,
    assert,
  }) => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const trip = await makeTrip(owner)

    const result = await pushOne(client, stranger, mutation(trip.id, 'stop', { name: 'Intruder' }))

    assert.equal(result.status, 'rejected')
    assert.equal(result.error?.code, 'E_ROW_NOT_FOUND')
    assert.notProperty(result, 'row')
    await dbAssert.assertCount('stops', 0)
  })

  test('an id that exists in another trip answers not found', async ({ client, assert }) => {
    const owner = await makeUser()
    const other = await makeUser()
    const trip = await makeTrip(owner)
    const otherTrip = await makeTrip(other)
    const stop = mutation(otherTrip.id, 'stop', { name: 'Theirs' })
    await pushApplied(client, other, stop)

    const result = await pushOne(
      client,
      owner,
      mutation(trip.id, 'stop', { name: 'Hijack' }, { id: stop.id })
    )

    assert.equal(result.status, 'rejected')
    assert.equal(result.error?.code, 'E_ROW_NOT_FOUND')
    const [row] = await db.from('stops').where('id', stop.id)
    assert.equal(row.name, 'Theirs')
  })

  test('a reference to a row of another trip answers not found', async ({ client, assert }) => {
    const owner = await makeUser()
    const other = await makeUser()
    const trip = await makeTrip(owner)
    const otherTrip = await makeTrip(other)
    const theirEvent = await pushApplied<{ id: string }>(
      client,
      other,
      mutation(otherTrip.id, 'event', { kind: 'tour', title: 'Theirs' })
    )

    const result = await pushOne(
      client,
      owner,
      mutation(trip.id, 'task', { title: 'Attach to their event', eventId: theirEvent.id })
    )

    assert.equal(result.status, 'rejected')
    assert.equal(result.error?.code, 'E_ROW_NOT_FOUND')
  })

  test('invalid changes reject that mutation alone, in the request locale', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const good = mutation(trip.id, 'stop', { name: 'Fine' })
    const bad = mutation(trip.id, 'stop', { name: 'x'.repeat(201), countryCode: 'Australia' })

    const response = await actingAs(client.post('/api/v1/sync/push'), owner)
      .header('Accept-Language', 'es')
      .json({ mutations: [bad, good] })

    response.assertStatus(200)
    const [rejected, applied] = response.body().data.results
    assert.equal(rejected.status, 'rejected')
    assert.equal(rejected.error.code, 'E_VALIDATION_ERROR')
    assert.equal(rejected.error.message, 'Algunos campos no son válidos')
    assert.sameMembers(
      rejected.error.errors.map((e: { field: string }) => e.field),
      ['name', 'countryCode']
    )
    assert.equal(applied.status, 'applied')
  })

  test('a row created without its required fields is rejected', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const result = await pushOne(client, owner, mutation(trip.id, 'event', { title: 'No kind' }))

    assert.equal(result.status, 'rejected')
    assert.deepEqual(
      result.error?.errors?.map((e) => [e.field, e.rule]),
      [['kind', 'required']]
    )
  })

  test('derived fields sent by the client are ignored', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const row = await pushApplied<{ startsAt: string; startsOn: string }>(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'meal',
        title: 'Lunch',
        startsLocal: '2027-01-22T12:00',
        startTz: 'Asia/Bangkok',
        startsAt: '2000-01-01T00:00:00.000Z',
        startsOn: '2000-01-01',
      })
    )

    assert.equal(row.startsAt, '2027-01-22T05:00:00.000Z')
    assert.equal(row.startsOn, '2027-01-22')
  })

  test('the batch is limited to one hundred mutations', async ({ client }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const mutations = Array.from({ length: 101 }, () => mutation(trip.id, 'stop', { name: 'x' }))

    const response = await actingAs(client.post('/api/v1/sync/push'), owner).json({ mutations })

    response.assertStatus(422)
  })

  test('editor cannot change base currency', async ({ client, assert }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)

    const result = await pushOne(
      client,
      editor,
      mutation(trip.id, 'trip', { baseCurrency: 'EUR', name: 'Renamed' }, { id: trip.id })
    )
    const renamed = await pushOne(
      client,
      editor,
      mutation(trip.id, 'trip', { name: 'Renamed by editor' }, { id: trip.id })
    )

    assert.equal(result.status, 'rejected')
    assert.equal(result.error?.code, 'E_TRIP_ROLE')
    assert.equal(renamed.status, 'applied')
    await trip.refresh()
    assert.equal(trip.baseCurrency, 'AUD')
    assert.equal(trip.name, 'Renamed by editor')
  })

  test('changing base currency with expenses answers 409', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const before = await pushOne(
      client,
      owner,
      mutation(trip.id, 'trip', { baseCurrency: 'NZD' }, { id: trip.id })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 1200, currency: 'NZD', spentOn: '2027-01-21' })
    )

    const after = await pushOne(
      client,
      owner,
      mutation(trip.id, 'trip', { baseCurrency: 'EUR' }, { id: trip.id })
    )

    assert.equal(before.status, 'applied')
    assert.equal(after.status, 'rejected')
    assert.equal(after.error?.code, 'E_BASE_CURRENCY_LOCKED')
    await trip.refresh()
    assert.equal(trip.baseCurrency, 'NZD')
  })

  test('the trip cannot be created or deleted through push', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const created = await pushOne(
      client,
      owner,
      mutation(randomUUID(), 'trip', { name: 'New' }, {})
    )
    const deleted = await pushOne(
      client,
      owner,
      mutation(trip.id, 'trip', {}, { id: trip.id, op: 'delete' })
    )

    assert.equal(created.error?.code, 'E_ROW_NOT_FOUND')
    assert.equal(deleted.error?.code, 'E_BAD_REQUEST')
    await trip.refresh()
    assert.isNull(trip.deletedAt)
  })

  test('emergency info merges per top-level key', async ({ client, assert }) => {
    const owner = await makeUser()
    const editor = await makeUser()
    const trip = await makeTrip(owner)
    await addMember(trip, editor)

    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'emergency',
        {
          contacts: [{ name: 'Travel insurer', phone: '0800 DEMO', note: null }],
          notes: 'Owner notes',
        },
        { id: trip.id, changedAt: '2026-11-07T09:30:00.000Z' }
      )
    )
    const editorEdit = await pushOne(
      client,
      editor,
      mutation(
        trip.id,
        'emergency',
        { notes: 'Older editor notes', medical: { notes: 'No allergies' } },
        { id: trip.id, changedAt: '2026-11-07T09:00:00.000Z' }
      )
    )

    assert.equal(editorEdit.status, 'partial')
    assert.deepEqual(editorEdit.rejectedFields, ['notes'])
    const row = editorEdit.row as unknown as { content: Record<string, unknown>; tripId: string }
    assert.equal(row.tripId, trip.id)
    assert.deepEqual(row.content, {
      contacts: [{ name: 'Travel insurer', phone: '0800 DEMO', note: null }],
      notes: 'Owner notes',
      medical: { notes: 'No allergies' },
    })
    const rejected = await pushOne(
      client,
      owner,
      mutation(trip.id, 'emergency', { notes: 'x' }, { id: randomUUID() })
    )
    assert.equal(rejected.error?.code, 'E_ROW_NOT_FOUND')
  })

  test('deleting an event tombstones its segments and seats and a second delete is a no-op', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const [traveller] = await db.from('travellers').where('trip_id', trip.id)
    const event = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'event', { kind: 'flight', title: 'Out' })
    )
    const segment = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'segment', {
        eventId: event.id,
        departsLocal: '2027-01-20T10:00',
        departsTz: 'Australia/Sydney',
        arrivesLocal: '2027-01-20T16:00',
        arrivesTz: 'Asia/Bangkok',
      })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'seat', { segmentId: segment.id, travellerId: traveller.id, seat: '12A' })
    )

    const results = await push(client, owner, [
      mutation(trip.id, 'event', {}, { id: event.id, op: 'delete' }),
      mutation(trip.id, 'event', {}, { id: event.id, op: 'delete' }),
    ])

    assert.deepEqual(
      results.map((r) => r.status),
      ['applied', 'applied']
    )
    const [seg] = await db.from('event_segments').where('id', segment.id)
    const [seat] = await db.from('segment_seats').where('segment_id', segment.id)
    assert.isNotNull(seg.deleted_at)
    assert.isNotNull(seat.deleted_at)
    const activity = await db
      .from('trip_activity')
      .where('trip_id', trip.id)
      .where('action', 'deleted')
    assert.lengthOf(activity, 1)
  })

  test('a failing mutation does not fail the batch', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const [traveller] = await db.from('travellers').where('trip_id', trip.id)
    const friend = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'traveller', { displayName: 'Friend without the app', position: 1 })
    )
    const event = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'event', { kind: 'train', title: 'Night train' })
    )
    const segment = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'segment', {
        eventId: event.id,
        departsLocal: '2027-01-21T20:00',
        departsTz: 'UTC',
        arrivesLocal: '2027-01-22T06:00',
        arrivesTz: 'UTC',
      })
    )
    const expense = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 3000,
        currency: 'AUD',
        spentOn: '2027-01-22',
        shares: [
          { id: randomUUID(), travellerId: traveller.id, shareMinor: 2000 },
          { id: randomUUID(), travellerId: friend.id, shareMinor: 1000 },
        ],
      })
    )
    const [friendShare] = await db
      .from('expense_shares')
      .where({ expense_id: expense.id, traveller_id: friend.id })
    const before = mutation(trip.id, 'stop', { name: 'Before' })
    const after = mutation(trip.id, 'stop', { name: 'After' })

    const results = await push(client, owner, [
      before,
      // The traveller already has a seat on this segment.
      mutation(trip.id, 'seat', { segmentId: segment.id, travellerId: traveller.id }),
      mutation(trip.id, 'seat', { segmentId: segment.id, travellerId: traveller.id }),
      // The other traveller already has a share of this expense.
      mutation(trip.id, 'expense_share', { travellerId: traveller.id }, { id: friendShare.id }),
      after,
    ])

    assert.deepEqual(
      results.map((r) => [r.status, r.error?.code ?? null]),
      [
        ['applied', null],
        ['applied', null],
        ['rejected', 'E_CONFLICT'],
        ['rejected', 'E_CONFLICT'],
        ['applied', null],
      ]
    )
    assert.lengthOf(await db.from('stops').whereIn('id', [before.id, after.id]), 2)
    const [share] = await db.from('expense_shares').where('id', friendShare.id)
    assert.equal(share.traveller_id, friend.id)
    assert.lengthOf(await db.from('segment_seats').where('segment_id', segment.id), 1)
  })

  test('segment reorder swaps positions without a conflict', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const event = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'event', { kind: 'flight', title: 'Two legs' })
    )
    const leg = (position: number, departs: string, arrives: string) =>
      mutation(trip.id, 'segment', {
        eventId: event.id,
        position,
        departsLocal: departs,
        departsTz: 'UTC',
        arrivesLocal: arrives,
        arrivesTz: 'UTC',
      })
    // Overlapping legs, so either order gives the event a valid start and end.
    const first = leg(0, '2027-01-21T08:00', '2027-01-21T14:00')
    const second = leg(1, '2027-01-21T10:00', '2027-01-21T12:00')
    await pushApplied(client, owner, first)
    await pushApplied(client, owner, second)

    const results = await push(client, owner, [
      mutation(trip.id, 'segment', { position: 1 }, { id: first.id }),
      mutation(trip.id, 'segment', { position: 0 }, { id: second.id }),
    ])

    assert.deepEqual(
      results.map((r) => r.status),
      ['applied', 'applied']
    )
    const positions = await db
      .from('event_segments')
      .where('event_id', event.id)
      .orderBy('position')
      .select('id', 'position')
    assert.deepEqual(positions, [
      { id: second.id, position: 0 },
      { id: first.id, position: 1 },
    ])
    // The legs drive the event in their new order.
    const [row] = await db.from('events').where('id', event.id)
    assert.equal(row.starts_at.toISOString(), '2027-01-21T10:00:00.000Z')
    assert.equal(row.ends_at.toISOString(), '2027-01-21T14:00:00.000Z')
  })

  test('invalid changed at is rejected', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const bad = mutation(trip.id, 'stop', { name: 'When?' }, { changedAt: 'yesterday' })
    const week = mutation(trip.id, 'stop', { name: 'Week date' }, { changedAt: '2026-W45-6' })
    const good = mutation(trip.id, 'stop', { name: 'Fine' })

    const results = await push(client, owner, [bad, week, good])

    assert.equal(results[0].status, 'rejected')
    assert.equal(results[0].error?.code, 'E_VALIDATION_ERROR')
    assert.deepEqual(
      results[0].error?.errors?.map((e) => [e.field, e.rule]),
      [['changedAt', 'instant']]
    )
    // Any ISO 8601 form the validator accepts is read the same way (2026-W45-6 = 7 Nov 2026).
    assert.equal(results[1].status, 'applied')
    const [row] = await db.from('stops').where('id', week.id)
    assert.equal(row.field_clock.name, Date.parse('2026-11-07T00:00:00Z'))
    assert.equal(results[2].status, 'applied')
    assert.isEmpty(await db.from('stops').where('id', bad.id))
  })
})
