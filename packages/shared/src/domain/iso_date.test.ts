import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  compareIsoDate,
  daysBetween,
  epochDaysToIsoDate,
  isIsoDate,
  isoDateRange,
  isoDateToEpochDays,
  parseIsoDate,
} from './iso_date.ts'

test('a real calendar date is accepted and an impossible one is not', () => {
  assert.equal(isIsoDate('2026-02-28'), true)
  assert.equal(isIsoDate('2028-02-29'), true)
  assert.equal(isIsoDate('2026-02-30'), false)
  assert.equal(isIsoDate('2026-13-01'), false)
  assert.equal(isIsoDate('20260101'), false)
  assert.equal(isIsoDate('2026-1-1'), false)
})

test('parsing an invalid date throws instead of guessing', () => {
  assert.deepEqual(parseIsoDate('2026-11-07'), { year: 2026, month: 11, day: 7 })
  assert.throws(() => parseIsoDate('yesterday'), RangeError)
})

test('adding days crosses month and year boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2026-01-15', 0), '2026-01-15')
})

test('days between is signed and ignores zones', () => {
  assert.equal(daysBetween('2026-01-10', '2026-01-21'), 11)
  assert.equal(daysBetween('2026-01-21', '2026-01-10'), -11)
  assert.equal(daysBetween('2026-01-10', '2026-01-10'), 0)
})

test('epoch days round trip', () => {
  assert.equal(isoDateToEpochDays('1970-01-01'), 0)
  assert.equal(epochDaysToIsoDate(isoDateToEpochDays('2026-07-04')), '2026-07-04')
})

test('comparison follows the calendar', () => {
  assert.equal(compareIsoDate('2026-01-01', '2026-01-02'), -1)
  assert.equal(compareIsoDate('2026-01-02', '2026-01-01'), 1)
  assert.equal(compareIsoDate('2026-01-02', '2026-01-02'), 0)
})

test('a date range excludes its end and is empty when reversed', () => {
  assert.deepEqual(isoDateRange('2026-01-30', '2026-02-02'), [
    '2026-01-30',
    '2026-01-31',
    '2026-02-01',
  ])
  assert.deepEqual(isoDateRange('2026-01-30', '2026-01-30'), [])
  assert.deepEqual(isoDateRange('2026-02-02', '2026-01-30'), [])
})
