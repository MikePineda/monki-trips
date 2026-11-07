import { test } from '@japa/runner'
import { clampChangedAt, lwwMerge } from '#domain/lww_merge'

const T0 = Date.UTC(2026, 10, 1, 10, 0, 0)
const MINUTE = 60_000

test.group('Field level last write wins', () => {
  test('older field change is rejected', ({ assert }) => {
    const result = lwwMerge({
      current: { title: 'Newer title' },
      deleted: false,
      clock: { title: T0 + MINUTE },
      changes: { title: 'Older title' },
      changedAt: T0,
    })

    assert.deepEqual(result, {
      outcome: 'merged',
      applied: {},
      rejectedFields: ['title'],
      clock: { title: T0 + MINUTE },
    })
  })

  test('concurrent edits to different fields both apply', ({ assert }) => {
    const first = lwwMerge({
      current: { title: 'Dinner', notes: null },
      deleted: false,
      clock: {},
      changes: { title: 'Dinner at the harbour' },
      changedAt: T0 + MINUTE,
    })
    assert.equal(first.outcome, 'merged')
    if (first.outcome !== 'merged') return

    const second = lwwMerge({
      current: { title: 'Dinner at the harbour', notes: null },
      deleted: false,
      clock: first.clock,
      changes: { notes: 'Book a table' },
      changedAt: T0,
    })

    assert.equal(second.outcome, 'merged')
    if (second.outcome !== 'merged') return
    assert.deepEqual(second.applied, { notes: 'Book a table' })
    assert.deepEqual(second.rejectedFields, [])
    assert.deepEqual(second.clock, { title: T0 + MINUTE, notes: T0 })
  })

  test('a tie goes to the change that arrives last', ({ assert }) => {
    const result = lwwMerge({
      current: { title: 'First' },
      deleted: false,
      clock: { title: T0 },
      changes: { title: 'Second' },
      changedAt: T0,
    })

    assert.equal(result.outcome, 'merged')
    assert.deepEqual(result.outcome === 'merged' && result.applied, { title: 'Second' })
  })

  test('update after delete is rejected', ({ assert }) => {
    const result = lwwMerge({
      current: { title: 'Gone' },
      deleted: true,
      clock: { title: T0 },
      changes: { title: 'Back' },
      changedAt: T0 + 10 * MINUTE,
    })

    assert.deepEqual(result, { outcome: 'deleted' })
  })

  test('a new row takes every field and stamps the clock', ({ assert }) => {
    const result = lwwMerge({
      current: null,
      deleted: false,
      clock: {},
      changes: { title: 'New', position: 2 },
      changedAt: T0,
    })

    assert.deepEqual(result, {
      outcome: 'merged',
      applied: { title: 'New', position: 2 },
      rejectedFields: [],
      clock: { title: T0, position: T0 },
    })
  })
})

test.group('Changed at clamp', () => {
  test('changed at is clamped to the allowed window', ({ assert }) => {
    const now = T0
    const day = 24 * 60 * MINUTE

    assert.equal(clampChangedAt(now - 100 * day, now, 45), now - 45 * day)
    assert.equal(clampChangedAt(now + day, now, 45), now)
    assert.equal(clampChangedAt(now - day, now, 45), now - day)
  })
})
