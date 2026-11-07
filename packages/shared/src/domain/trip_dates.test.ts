import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isTripNight,
  tripDayNumber,
  tripNightDates,
  tripPhase,
  tripTotalDays,
} from './trip_dates.ts'

const trip = { startsOn: '2026-01-10', endsOn: '2026-01-21' }

test('trip phase is derived from today and never stored', () => {
  assert.equal(tripPhase(trip, '2026-01-09'), 'upcoming')
  assert.equal(tripPhase(trip, '2026-01-10'), 'ongoing')
  assert.equal(tripPhase(trip, '2026-01-21'), 'ongoing')
  assert.equal(tripPhase(trip, '2026-01-22'), 'past')
})

test('total days include both ends', () => {
  assert.equal(tripTotalDays(trip), 12)
  assert.equal(tripTotalDays({ startsOn: '2026-05-05', endsOn: '2026-05-05' }), 1)
})

test('nights run from the first day to the eve of the last; a one-day trip has none', () => {
  const nights = tripNightDates(trip)
  assert.equal(nights.length, 11)
  assert.equal(nights[0], '2026-01-10')
  assert.equal(nights.at(-1), '2026-01-20')
  assert.deepEqual(tripNightDates({ startsOn: '2026-05-05', endsOn: '2026-05-05' }), [])
})

test('day number counts from one and is null outside the trip', () => {
  assert.equal(tripDayNumber(trip, '2026-01-10'), 1)
  assert.equal(tripDayNumber(trip, '2026-01-13'), 4)
  assert.equal(tripDayNumber(trip, '2026-01-21'), 12)
  assert.equal(tripDayNumber(trip, '2026-01-22'), null)
  assert.equal(tripDayNumber(trip, '2026-01-01'), null)
})

test('the last day has no night to cover', () => {
  assert.equal(isTripNight(trip, '2026-01-10'), true)
  assert.equal(isTripNight(trip, '2026-01-20'), true)
  assert.equal(isTripNight(trip, '2026-01-21'), false)
  assert.equal(isTripNight(trip, '2026-01-09'), false)
})
