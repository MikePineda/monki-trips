import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leaveAtMs, leaveBufferMin } from './leave_at.ts'

test('each transport kind has its own default buffer and the rest get fifteen minutes', () => {
  assert.equal(leaveBufferMin('flight'), 150)
  assert.equal(leaveBufferMin('train'), 30)
  assert.equal(leaveBufferMin('ferry'), 45)
  assert.equal(leaveBufferMin('bus'), 20)
  assert.equal(leaveBufferMin('car'), 15)
  assert.equal(leaveBufferMin('tour'), 15)
  assert.equal(leaveBufferMin('lodging'), 15)
})

test('the event buffer overrides the kind default, including zero', () => {
  assert.equal(leaveBufferMin('flight', 90), 90)
  assert.equal(leaveBufferMin('flight', 0), 0)
  assert.equal(leaveBufferMin('flight', null), 150)
})

test('leave at subtracts the buffer and the travel time from the start', () => {
  const starts = Date.parse('2026-01-13T15:00:00Z')
  assert.equal(leaveAtMs(starts, 'flight', null, 40), Date.parse('2026-01-13T11:50:00Z'))
  assert.equal(leaveAtMs(starts, 'train'), Date.parse('2026-01-13T14:30:00Z'))
  assert.equal(leaveAtMs(starts, 'meal', 5, 10), Date.parse('2026-01-13T14:45:00Z'))
})
