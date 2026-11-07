import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  epochMs,
  instantOfLocal,
  instantOfLocalMs,
  localDate,
  localDateTime,
  localMinutesOfDay,
  zonedFromLocal,
} from './zoned_instant.ts'

test('local wall clock follows the offset the caller resolved', () => {
  const zoned = { at: '2026-01-20T15:30:00Z', offsetMin: 540 }
  assert.equal(localDateTime(zoned), '2026-01-21T00:30')
  assert.equal(localDate(zoned), '2026-01-21')
  assert.equal(localMinutesOfDay(zoned), 30)
})

test('a negative offset moves the local date back across midnight', () => {
  const zoned = { at: '2026-01-21T03:00:00Z', offsetMin: -300 }
  assert.equal(localDateTime(zoned), '2026-01-20T22:00')
  assert.equal(localDate(zoned), '2026-01-20')
})

test('half-hour and quarter-hour offsets are plain minutes', () => {
  assert.equal(localDateTime({ at: '2026-01-20T12:00:00Z', offsetMin: 345 }), '2026-01-20T17:45')
  assert.equal(localDateTime({ at: '2026-01-20T12:00:00Z', offsetMin: -210 }), '2026-01-20T08:30')
})

test('a local time with its offset becomes the right instant and round trips', () => {
  assert.equal(instantOfLocal('2026-01-21T00:30', 540), '2026-01-20T15:30:00.000Z')
  assert.equal(instantOfLocal('2026-01-20T22:00:15', -300), '2026-01-21T03:00:15.000Z')
  const zoned = zonedFromLocal('2026-03-29T01:30', 60, 'Zone/Synthetic')
  assert.equal(localDateTime(zoned), '2026-03-29T01:30')
  assert.equal(zoned.tz, 'Zone/Synthetic')
})

test('DST gap: the same wall clock before and after spring forward is one hour apart in UTC', () => {
  // Spring forward at 02:00 local: 01:59 is read with +60, the next tick 03:00 with +120.
  const before = instantOfLocalMs('2026-03-29T01:59', 60)
  const after = instantOfLocalMs('2026-03-29T03:00', 120)
  assert.equal(after - before, 60_000)
  // 02:30 does not exist; the caller never produces an offset for it, so the
  // domain only ever sees the two existing readings.
  assert.equal(
    localDateTime({ at: new Date(before).toISOString(), offsetMin: 60 }),
    '2026-03-29T01:59'
  )
  assert.equal(
    localDateTime({ at: new Date(after).toISOString(), offsetMin: 120 }),
    '2026-03-29T03:00'
  )
})

test('DST overlap: an ambiguous wall clock is two instants told apart by the offset', () => {
  // Fall back at 03:00 local: 02:30 happens twice, first with +120 then with +60.
  const first = zonedFromLocal('2026-10-25T02:30', 120)
  const second = zonedFromLocal('2026-10-25T02:30', 60)
  assert.equal(first.at, '2026-10-25T00:30:00.000Z')
  assert.equal(second.at, '2026-10-25T01:30:00.000Z')
  assert.equal(localDateTime(first), localDateTime(second))
  assert.equal(epochMs(second.at) - epochMs(first.at), 3_600_000)
})

test('malformed instants and local times throw instead of yielding NaN', () => {
  assert.throws(() => epochMs('not a date'), RangeError)
  assert.throws(() => instantOfLocal('2026-01-20 10:00', 0), RangeError)
  assert.throws(() => instantOfLocal('2026-13-40T10:00', 0), RangeError)
})
