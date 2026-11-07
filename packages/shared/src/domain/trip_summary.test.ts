import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tripSummary } from './trip_summary.ts'

const trip = { startsOn: '2026-01-10', endsOn: '2026-01-21' }

const stops = [
  { position: 3, countryCode: 'XA' },
  { position: 1, countryCode: 'XB' },
  { position: 2, countryCode: 'XA' },
  { position: 4, countryCode: null },
]

test('summary counts distinct countries from stops', () => {
  const summary = tripSummary(trip, stops, '2026-01-13')
  assert.deepEqual(summary.countries, ['XB', 'XA'])
  assert.equal(summary.countryCount, 2)
  assert.equal(summary.stopCount, 4)
})

test('past trip derives from ends_on before today', () => {
  const summary = tripSummary(trip, stops, '2026-01-25')
  assert.equal(summary.phase, 'past')
  assert.equal(summary.daysSinceEnd, 4)
  assert.equal(summary.dayNumber, null)
  assert.equal(summary.daysUntilStart, null)
})

test('an upcoming trip counts the days until departure', () => {
  const summary = tripSummary(trip, [], '2026-01-01')
  assert.equal(summary.phase, 'upcoming')
  assert.equal(summary.daysUntilStart, 9)
  assert.equal(summary.dayNumber, null)
})

test('an ongoing trip without stops still has its days and nights', () => {
  const summary = tripSummary(trip, [], '2026-01-13')
  assert.equal(summary.phase, 'ongoing')
  assert.equal(summary.totalDays, 12)
  assert.equal(summary.nights, 11)
  assert.equal(summary.dayNumber, 4)
  assert.deepEqual(summary.countries, [])
  assert.equal(summary.countryCount, 0)
})
