import { test } from '@japa/runner'
import { taskUrgency } from '#domain/task_urgency'

test.group('Task urgency', () => {
  test('task due yesterday is overdue', ({ assert }) => {
    assert.equal(taskUrgency('2027-01-19', '2027-01-20'), 'overdue')
  })

  test('undated task goes to no_date', ({ assert }) => {
    assert.equal(taskUrgency(null, '2027-01-20'), 'no_date')
  })

  test('today, this week and later follow the calendar', ({ assert }) => {
    assert.equal(taskUrgency('2027-01-20', '2027-01-20'), 'today')
    assert.equal(taskUrgency('2027-01-27', '2027-01-20'), 'this_week')
    assert.equal(taskUrgency('2027-01-28', '2027-01-20'), 'later')
  })
})
