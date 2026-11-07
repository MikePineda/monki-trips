import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventDay, isActiveEvent, isTransportKind, sortedSegments } from './trip_event.ts'

test('flights, trains, ferries, buses and cars are transport; lodging and meals are not', () => {
  assert.equal(isTransportKind('flight'), true)
  assert.equal(isTransportKind('car'), true)
  assert.equal(isTransportKind('lodging'), false)
  assert.equal(isTransportKind('meal'), false)
})

test('cancelled events and ideas are not active', () => {
  assert.equal(isActiveEvent({ status: 'booked' }), true)
  assert.equal(isActiveEvent({ status: 'to_book' }), true)
  assert.equal(isActiveEvent({ status: 'paid' }), true)
  assert.equal(isActiveEvent({ status: 'cancelled' }), false)
  assert.equal(isActiveEvent({ status: 'idea' }), false)
})

test('the event day is the local start date in the departure zone', () => {
  assert.equal(eventDay({ starts: { at: '2026-01-20T15:30:00Z', offsetMin: 540 } }), '2026-01-21')
  assert.equal(eventDay({ starts: { at: '2026-01-20T15:30:00Z', offsetMin: -600 } }), '2026-01-20')
})

test('segments come back ordered by position', () => {
  const departs = { at: '2026-01-20T10:00:00Z', offsetMin: 0 }
  const segments = sortedSegments({
    segments: [
      { id: 'b', position: 2, departs, arrives: null },
      { id: 'a', position: 1, departs, arrives: null },
    ],
  })
  assert.deepEqual(
    segments.map((s) => s.id),
    ['a', 'b']
  )
  assert.deepEqual(sortedSegments({}), [])
})
