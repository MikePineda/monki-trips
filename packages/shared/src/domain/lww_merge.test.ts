import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampChangedAt, LWW_MAX_AGE_MS, lwwMerge, type LwwRow } from './lww_merge.ts'

const now = Date.parse('2026-01-13T12:00:00Z')
const t0 = now - 10 * 60_000
const t1 = now - 5 * 60_000

const row: LwwRow = {
  fields: { title: 'Harbour Inn', notes: 'ask for a quiet room' },
  fieldClock: { title: t1, notes: t1 },
  deletedAt: null,
}

test('older field change is rejected', () => {
  const result = lwwMerge(row, { op: 'upsert', changes: { title: 'Old name' }, changedAt: t0 }, now)
  assert.equal(result.status, 'rejected')
  assert.deepEqual(result.rejectedFields, ['title'])
  assert.deepEqual(result.rejectedReasons, { title: 'older' })
  assert.equal(result.row.fields.title, 'Harbour Inn')
  assert.equal(result.row.fieldClock.title, t1)
  assert.equal(result.error, null)
})

test('concurrent edits to different fields both apply', () => {
  const fromPhone = lwwMerge(
    row,
    { op: 'upsert', changes: { title: 'Harbour Inn & Spa' }, changedAt: t1 + 1 },
    now
  )
  const fromLaptop = lwwMerge(
    fromPhone.row,
    { op: 'upsert', changes: { notes: 'late check-in' }, changedAt: t1 + 2 },
    now
  )
  assert.equal(fromPhone.status, 'applied')
  assert.equal(fromLaptop.status, 'applied')
  assert.deepEqual(fromLaptop.row.fields, { title: 'Harbour Inn & Spa', notes: 'late check-in' })
  assert.deepEqual(fromLaptop.row.fieldClock, { title: t1 + 1, notes: t1 + 2 })
})

test('on a tie the last to arrive wins', () => {
  const result = lwwMerge(
    row,
    { op: 'upsert', changes: { title: 'Same clock' }, changedAt: t1 },
    now
  )
  assert.equal(result.status, 'applied')
  assert.equal(result.row.fields.title, 'Same clock')
})

test('a mix of newer and older fields is partial', () => {
  const result = lwwMerge(
    row,
    { op: 'upsert', changes: { title: 'Newer', notes: 'older' }, changedAt: t1 },
    now
  )
  // Both tie at t1, so both apply; make notes older to see the split.
  assert.equal(result.status, 'applied')
  const split = lwwMerge(
    { ...row, fieldClock: { title: t0, notes: t1 + 1 } },
    { op: 'upsert', changes: { title: 'Newer', notes: 'older' }, changedAt: t1 },
    now
  )
  assert.equal(split.status, 'partial')
  assert.deepEqual(split.appliedFields, ['title'])
  assert.deepEqual(split.rejectedFields, ['notes'])
})

test('update after delete is rejected', () => {
  const deleted = lwwMerge(row, { op: 'delete', changes: {}, changedAt: t0 }, now)
  assert.equal(deleted.status, 'applied')
  assert.equal(deleted.row.deletedAt, '2026-01-13T12:00:00.000Z')
  const later = lwwMerge(
    deleted.row,
    { op: 'upsert', changes: { title: 'Back from the dead' }, changedAt: now },
    now + 1_000
  )
  assert.equal(later.status, 'rejected')
  assert.equal(later.error, 'E_ROW_DELETED')
  assert.deepEqual(later.rejectedReasons, { title: 'deleted' })
  assert.equal(later.row.fields.title, 'Harbour Inn')
  assert.equal(later.row.deletedAt, '2026-01-13T12:00:00.000Z')
})

test('a tombstone wins over newer clocks and deleting twice keeps the first date', () => {
  const freshRow: LwwRow = { ...row, fieldClock: { title: now, notes: now } }
  const deleted = lwwMerge(freshRow, { op: 'delete', changes: {}, changedAt: t0 }, now)
  assert.equal(deleted.row.deletedAt, '2026-01-13T12:00:00.000Z')
  const again = lwwMerge(deleted.row, { op: 'delete', changes: {}, changedAt: now }, now + 60_000)
  assert.equal(again.status, 'applied')
  assert.equal(again.row.deletedAt, '2026-01-13T12:00:00.000Z')
})

test('changedAt is clamped to the last forty-five days and never to the future', () => {
  assert.equal(clampChangedAt(now + 3_600_000, now), now)
  assert.equal(clampChangedAt(now - LWW_MAX_AGE_MS - 1, now), now - LWW_MAX_AGE_MS)
  assert.equal(clampChangedAt(t1, now), t1)
  assert.equal(clampChangedAt(Number.NaN, now), now)
  // A phone with a clock set to next year cannot pre-empt a real later edit.
  const fromTheFuture = lwwMerge(
    row,
    { op: 'upsert', changes: { title: 'Future' }, changedAt: now + 86_400_000 },
    now
  )
  assert.equal(fromTheFuture.changedAt, now)
  assert.equal(fromTheFuture.row.fieldClock.title, now)
  // An ancient clock is pulled up to the horizon, so it still loses to a recent edit.
  const ancient = lwwMerge(
    { ...row, fieldClock: { title: now - LWW_MAX_AGE_MS + 1, notes: t1 } },
    { op: 'upsert', changes: { title: 'Ancient' }, changedAt: 0 },
    now
  )
  assert.equal(ancient.changedAt, now - LWW_MAX_AGE_MS)
  assert.equal(ancient.status, 'rejected')
})

test('derived fields are never accepted from the client', () => {
  const result = lwwMerge(
    row,
    {
      op: 'upsert',
      changes: { title: 'Renamed', startsAt: '2026-01-01T00:00:00Z' },
      changedAt: now,
    },
    now,
    { derivedFields: ['startsAt', 'endsAt', 'startsOn'] }
  )
  assert.equal(result.status, 'partial')
  assert.deepEqual(result.rejectedReasons, { startsAt: 'derived' })
  assert.equal('startsAt' in result.row.fields, false)
})

test('a new row takes every field with the mutation clock', () => {
  const result = lwwMerge(
    null,
    { op: 'upsert', changes: { title: 'New', notes: null }, changedAt: t1 },
    now
  )
  assert.equal(result.status, 'applied')
  assert.deepEqual(result.row, {
    fields: { title: 'New', notes: null },
    fieldClock: { title: t1, notes: t1 },
    deletedAt: null,
  })
})

test('the merge never mutates its inputs', () => {
  const frozen: LwwRow = { fields: { title: 'A' }, fieldClock: { title: t0 }, deletedAt: null }
  lwwMerge(frozen, { op: 'upsert', changes: { title: 'B' }, changedAt: now }, now)
  lwwMerge(frozen, { op: 'delete', changes: {}, changedAt: now }, now)
  assert.deepEqual(frozen, { fields: { title: 'A' }, fieldClock: { title: t0 }, deletedAt: null })
})
