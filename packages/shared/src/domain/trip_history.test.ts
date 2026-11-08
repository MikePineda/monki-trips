import { test } from 'node:test'
import assert from 'node:assert/strict'
import { celebratedTrip, historyGroups } from './trip_history.ts'

const trips = [
  { id: 'later', startsOn: '2027-06-01', endsOn: '2027-06-10' },
  { id: 'old', startsOn: '2025-03-01', endsOn: '2025-03-05' },
  { id: 'now', startsOn: '2026-11-01', endsOn: '2026-11-20' },
  { id: 'soon', startsOn: '2027-01-20', endsOn: '2027-02-06' },
  { id: 'recent', startsOn: '2026-09-01', endsOn: '2026-09-12' },
]

test('history groups trips by phase', () => {
  const groups = historyGroups(trips, '2026-11-08')

  assert.deepEqual(
    groups.upcoming.map((trip) => trip.id),
    ['soon', 'later'],
    'upcoming: the next departure first'
  )
  assert.deepEqual(
    groups.ongoing.map((trip) => trip.id),
    ['now']
  )
  assert.deepEqual(
    groups.past.map((trip) => trip.id),
    ['recent', 'old'],
    'past: the latest return first'
  )
})

test('a trip on its last day is still ongoing and the day after it is past', () => {
  const trip = { id: 't', startsOn: '2026-11-01', endsOn: '2026-11-08' }
  assert.equal(historyGroups([trip], '2026-11-08').ongoing.length, 1)
  assert.equal(historyGroups([trip], '2026-11-09').past.length, 1)
})

test('the most recent trip that ended within seven days is the one we celebrate', () => {
  const ended = [
    { id: 'a', startsOn: '2026-10-01', endsOn: '2026-11-02' },
    { id: 'b', startsOn: '2026-10-20', endsOn: '2026-11-05' },
  ]
  assert.equal(celebratedTrip(ended, '2026-11-08')?.id, 'b')
  assert.equal(celebratedTrip(ended, '2026-11-12')?.id, 'b', 'seven days after the end')
  assert.equal(celebratedTrip(ended, '2026-11-13'), null, 'eight days after: over')
  assert.equal(celebratedTrip(ended, '2026-11-05'), null, 'the last day itself is not over yet')
})

test('nothing to celebrate while a newer trip is already under way', () => {
  const list = [
    { id: 'done', startsOn: '2026-10-01', endsOn: '2026-11-05' },
    { id: 'next', startsOn: '2026-11-07', endsOn: '2026-11-20' },
  ]
  assert.equal(celebratedTrip(list, '2026-11-08'), null)
})
