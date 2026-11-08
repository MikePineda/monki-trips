import { test } from '@japa/runner'
import type { TripEventRow, TripStopRow, TripTaskRow } from '@monkitrips/shared'
import { toReminderTrip } from '#domain/reminder_trip'

const TRIP = {
  id: 'trip-1',
  name: 'Demo Loop',
  startsOn: '2027-01-20',
  endsOn: '2027-01-29',
  homeTz: 'Australia/Sydney',
}

function eventRow(overrides: Partial<TripEventRow>): TripEventRow {
  return {
    id: 'ev-1',
    tripId: 'trip-1',
    kind: 'flight',
    status: 'booked',
    title: 'Flight',
    stopId: null,
    startsLocal: '2027-01-22T14:00:00',
    startTz: 'Asia/Bangkok',
    startsAt: '2027-01-22T07:00:00.000Z',
    startsOn: '2027-01-22',
    endsLocal: null,
    endTz: null,
    endsAt: null,
    ...overrides,
  } as TripEventRow
}

test.group('Reminder trip', () => {
  test('event instants become zoned instants with the offset of their zone', ({ assert }) => {
    const trip = toReminderTrip(TRIP, {
      stops: [],
      tasks: [],
      events: [
        eventRow({
          endsLocal: '2027-01-22T20:00:00',
          endTz: 'Asia/Tokyo',
          endsAt: '2027-01-22T11:00:00.000Z',
          leaveBufferMin: 90,
          travelMin: 20,
        }),
      ],
    })

    assert.deepEqual(trip.events[0]?.starts, {
      at: '2027-01-22T07:00:00.000Z',
      offsetMin: 420,
      tz: 'Asia/Bangkok',
    })
    assert.deepEqual(trip.events[0]?.ends, {
      at: '2027-01-22T11:00:00.000Z',
      offsetMin: 540,
      tz: 'Asia/Tokyo',
    })
    assert.equal(trip.events[0]?.leaveBufferMin, 90)
    assert.equal(trip.events[0]?.travelMin, 20)
  })

  test('undated events and stops without a zone or dates are left out', ({ assert }) => {
    const trip = toReminderTrip(TRIP, {
      events: [eventRow({ id: 'undated', startsAt: null, startsLocal: null, startTz: null })],
      stops: [
        {
          id: 's1',
          position: 1,
          name: 'A',
          countryCode: null,
          tz: null,
          arriveOn: '2027-01-20',
          departOn: '2027-01-22',
        },
        {
          id: 's2',
          position: 2,
          name: 'B',
          countryCode: null,
          tz: 'Asia/Bangkok',
          arriveOn: null,
          departOn: null,
        },
        {
          id: 's3',
          position: 3,
          name: 'C',
          countryCode: null,
          tz: 'Asia/Bangkok',
          arriveOn: '2027-01-21',
          departOn: '2027-01-24',
        },
      ] as TripStopRow[],
      tasks: [
        {
          id: 't1',
          title: 'Pack',
          dueOn: '2027-01-21',
          priority: 'high',
          doneAt: null,
        } as TripTaskRow,
      ],
    })

    assert.deepEqual(trip.events, [])
    assert.deepEqual(
      trip.stops.map((stop) => stop.id),
      ['s3']
    )
    assert.deepEqual(
      trip.tasks.map((task) => [task.id, task.priority]),
      [['t1', 'high']]
    )
    assert.include(trip, { id: 'trip-1', name: 'Demo Loop', endsOn: '2027-01-29' })
  })
})
