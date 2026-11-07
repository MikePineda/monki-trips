import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupTasksByUrgency, hasOverdueHighTask, taskUrgency } from './task_urgency.ts'
import type { TripTask } from './trip_task.ts'

const today = '2026-01-13'

function task(id: string, dueOn: string | null, extra: Partial<TripTask> = {}): TripTask {
  return { id, title: id, dueOn, priority: 'normal', doneAt: null, origin: 'manual', ...extra }
}

test('task due yesterday is overdue', () => {
  assert.equal(taskUrgency(task('t', '2026-01-12'), today), 'overdue')
})

test('undated task goes to no_date', () => {
  assert.equal(taskUrgency(task('t', null), today), 'no_date')
})

test('this week ends seven days out and later starts on the eighth', () => {
  assert.equal(taskUrgency(task('t', '2026-01-13'), today), 'today')
  assert.equal(taskUrgency(task('t', '2026-01-14'), today), 'this_week')
  assert.equal(taskUrgency(task('t', '2026-01-20'), today), 'this_week')
  assert.equal(taskUrgency(task('t', '2026-01-21'), today), 'later')
})

test('a done task has no urgency and is left out of the groups', () => {
  assert.equal(
    taskUrgency(task('t', '2026-01-01', { doneAt: '2026-01-02T08:00:00Z' }), today),
    null
  )
  const groups = groupTasksByUrgency(
    [
      task('late-done', '2026-01-01', { doneAt: '2026-01-02T08:00:00Z' }),
      task('later', '2026-02-01'),
      task('soon', '2026-01-15'),
      task('sooner', '2026-01-14'),
      task('late', '2026-01-10'),
      task('now', '2026-01-13'),
      task('someday', null),
    ],
    today
  )
  assert.deepEqual(
    Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((t) => t.id)])),
    {
      overdue: ['late'],
      today: ['now'],
      this_week: ['sooner', 'soon'],
      later: ['later'],
      no_date: ['someday'],
    }
  )
})

test('an overdue high task is spotted, a done or normal one is not', () => {
  assert.equal(hasOverdueHighTask([task('t', '2026-01-12', { priority: 'high' })], today), true)
  assert.equal(hasOverdueHighTask([task('t', '2026-01-12')], today), false)
  assert.equal(
    hasOverdueHighTask(
      [task('t', '2026-01-12', { priority: 'high', doneAt: '2026-01-12T20:00:00Z' })],
      today
    ),
    false
  )
  assert.equal(hasOverdueHighTask([task('t', '2026-01-14', { priority: 'high' })], today), false)
})
