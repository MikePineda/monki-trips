import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { EventSegmentRow, TripEventRow } from '@monkitrips/shared'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pushApplied, pushOne } from '#tests/helpers/sync'

test.group('Itinerary', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))

  test('event utc times are derived from local time and zone', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const event = await pushApplied<TripEventRow>(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'lodging',
        title: 'Riverside Inn',
        status: 'booked',
        startsLocal: '2027-01-21T15:00',
        startTz: 'Asia/Bangkok',
        endsLocal: '2027-01-23T11:00',
        endTz: 'Asia/Bangkok',
      })
    )

    assert.include(event, {
      startsLocal: '2027-01-21T15:00:00',
      startsAt: '2027-01-21T08:00:00.000Z',
      startsOn: '2027-01-21',
      endsLocal: '2027-01-23T11:00:00',
      endsAt: '2027-01-23T04:00:00.000Z',
    })
  })

  test('nonexistent local time is rejected', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const result = await pushOne(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'tour',
        title: 'Spring forward',
        startsLocal: '2026-03-08T02:30',
        startTz: 'America/New_York',
      })
    )

    assert.equal(result.status, 'rejected')
    assert.equal(result.error?.code, 'E_VALIDATION_ERROR')
    assert.deepEqual(
      result.error?.errors?.map((e) => [e.field, e.rule]),
      [['startsLocal', 'nonexistentLocalTime']]
    )
  })

  test('an ambiguous local time takes the earlier offset', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const event = await pushApplied<TripEventRow>(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'meal',
        title: 'Fall back',
        startsLocal: '2026-11-01T01:30',
        startTz: 'America/New_York',
      })
    )

    assert.equal(event.startsAt, '2026-11-01T05:30:00.000Z')
  })

  test('a flight that lands before it departed on the local clock is fine, one that ends before it starts is not', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const ok = await pushOne(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'flight',
        title: 'Across the date line',
        startsLocal: '2027-02-05T22:00',
        startTz: 'Pacific/Apia',
        endsLocal: '2027-02-05T10:00',
        endTz: 'Pacific/Honolulu',
      })
    )
    const bad = await pushOne(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'tour',
        title: 'Backwards',
        startsLocal: '2027-01-22T10:00',
        startTz: 'UTC',
        endsLocal: '2027-01-22T09:00',
        endTz: 'UTC',
      })
    )

    assert.equal(ok.status, 'applied')
    assert.equal(bad.status, 'rejected')
    assert.deepEqual(
      bad.error?.errors?.map((e) => [e.field, e.rule]),
      [['endsLocal', 'afterOrEqual']]
    )
  })

  test('a time zone is required with a local time and the cost needs its currency', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const noZone = await pushOne(
      client,
      owner,
      mutation(trip.id, 'event', { kind: 'tour', title: 'x', startsLocal: '2027-01-22T10:00' })
    )
    const noCurrency = await pushOne(
      client,
      owner,
      mutation(trip.id, 'event', { kind: 'tour', title: 'x', costMinor: 1000 })
    )

    assert.deepEqual(
      noZone.error?.errors?.map((e) => [e.field, e.rule]),
      [['startTz', 'required']]
    )
    assert.deepEqual(
      noCurrency.error?.errors?.map((e) => [e.field, e.rule]),
      [['costCurrency', 'required']]
    )
  })

  test('segments drive event start and end', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const eventId = randomUUID()
    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'event',
        {
          kind: 'flight',
          title: 'Home via a hub',
          startsLocal: '2027-01-01T00:00',
          startTz: 'UTC',
        },
        { id: eventId }
      )
    )

    const leg2 = await pushApplied<EventSegmentRow>(
      client,
      owner,
      mutation(trip.id, 'segment', {
        eventId,
        position: 2,
        departsLocal: '2027-02-06T01:30',
        departsTz: 'Asia/Singapore',
        arrivesLocal: '2027-02-06T12:00',
        arrivesTz: 'Australia/Sydney',
      })
    )
    const leg1 = await pushApplied<EventSegmentRow>(
      client,
      owner,
      mutation(trip.id, 'segment', {
        eventId,
        position: 1,
        departsLocal: '2027-02-05T19:00',
        departsTz: 'Asia/Tokyo',
        arrivesLocal: '2027-02-06T00:30',
        arrivesTz: 'Asia/Singapore',
      })
    )

    assert.equal(leg1.departsAt, '2027-02-05T10:00:00.000Z')
    assert.equal(leg2.arrivesAt, '2027-02-06T01:00:00.000Z')
    const [event] = await db.from('events').where('id', eventId)
    assert.equal(event.starts_at.toISOString(), '2027-02-05T10:00:00.000Z')
    assert.equal(event.start_tz, 'Asia/Tokyo')
    assert.equal(event.ends_at.toISOString(), '2027-02-06T01:00:00.000Z')
    assert.equal(event.end_tz, 'Australia/Sydney')

    // A client edit of the start loses against the segments.
    const edited = await pushApplied<TripEventRow>(
      client,
      owner,
      mutation(
        trip.id,
        'event',
        { startsLocal: '2027-02-05T06:00', startTz: 'Asia/Tokyo' },
        { id: eventId }
      )
    )
    assert.equal(edited.startsAt, '2027-02-05T10:00:00.000Z')
    assert.equal(edited.startsOn, '2027-02-05')

    // Deleting the first leg moves the start to the second.
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'segment', {}, { id: leg1.id, op: 'delete' })
    )
    const [after] = await db.from('events').where('id', eventId)
    assert.equal(after.starts_at.toISOString(), '2027-02-05T17:30:00.000Z')
    assert.equal(after.start_tz, 'Asia/Singapore')
  })

  test('a segment never moves to another event', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const a = await pushApplied<TripEventRow>(
      client,
      owner,
      mutation(trip.id, 'event', { kind: 'train', title: 'A' })
    )
    const b = await pushApplied<TripEventRow>(
      client,
      owner,
      mutation(trip.id, 'event', { kind: 'train', title: 'B' })
    )
    const segment = await pushApplied<EventSegmentRow>(
      client,
      owner,
      mutation(trip.id, 'segment', {
        eventId: a.id,
        departsLocal: '2027-01-22T10:00',
        departsTz: 'UTC',
        arrivesLocal: '2027-01-22T12:00',
        arrivesTz: 'UTC',
      })
    )

    const moved = await pushOne(
      client,
      owner,
      mutation(trip.id, 'segment', { eventId: b.id }, { id: segment.id })
    )

    assert.equal(moved.status, 'rejected')
    assert.deepEqual(
      moved.error?.errors?.map((e) => [e.field, e.rule]),
      [['eventId', 'immutable']]
    )
  })

  test('nights endpoint flags the night without lodging', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner, { startsOn: '2027-01-20', endsOn: '2027-01-24' })
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'lodging',
        title: 'Riverside Inn',
        status: 'booked',
        startsLocal: '2027-01-20T15:00',
        startTz: 'Asia/Bangkok',
        endsLocal: '2027-01-22T11:00',
        endTz: 'Asia/Bangkok',
      })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'event', {
        kind: 'train',
        title: 'Night train north',
        status: 'booked',
        startsLocal: '2027-01-22T20:00',
        startTz: 'Asia/Bangkok',
        endsLocal: '2027-01-23T07:30',
        endTz: 'Asia/Bangkok',
      })
    )

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/nights`), owner)

    response.assertStatus(200)
    const { nights, uncoveredCount } = response.body().data
    assert.equal(uncoveredCount, 1)
    assert.deepEqual(
      nights.map(
        (night: { date: string; covered: boolean; coveredBy: { kind: string } | null }) => [
          night.date,
          night.covered,
          night.coveredBy?.kind ?? null,
        ]
      ),
      [
        ['2027-01-20', true, 'lodging'],
        ['2027-01-21', true, 'lodging'],
        ['2027-01-22', true, 'train'],
        ['2027-01-23', false, null],
      ]
    )
  })

  test('the snapshot returns the full trip content', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const stop = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'stop', { name: 'Harbour Town' })
    )
    await pushApplied(client, owner, mutation(trip.id, 'task', { title: 'Pack' }))
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'emergency', { notes: 'Keep calm' }, { id: trip.id })
    )

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/snapshot`), owner)

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.trip.id, trip.id)
    assert.lengthOf(data.members, 1)
    assert.lengthOf(data.travellers, 1)
    assert.deepEqual(
      data.stops.map((s: { id: string }) => s.id),
      [stop.id]
    )
    assert.lengthOf(data.tasks, 1)
    assert.lengthOf(data.budgetCategories, 6)
    assert.deepEqual(data.emergency.content, { notes: 'Keep calm' })
    assert.deepEqual(data.events, [])
    assert.deepEqual(data.phraseCards, [])
  })
})
