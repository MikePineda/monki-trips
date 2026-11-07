import { test } from '@japa/runner'
import { printTaskChanges } from '#domain/print_tasks'

const voucher = { id: 'doc-1', title: 'Rail voucher', tags: ['print' as const], deleted: false }
const trip = { startsOn: '2027-01-20', today: '2026-12-01' }

test.group('Print tasks', () => {
  test('print tag creates one print task due the day before departure', ({ assert }) => {
    const action = printTaskChanges({ document: voucher, existing: null, ...trip })

    assert.deepEqual(action, {
      action: 'create',
      task: {
        title: 'Rail voucher',
        titleKey: 'print_document',
        dueOn: '2027-01-19',
        priority: 'normal',
      },
    })
  })

  test('adding the tag twice keeps one task', ({ assert }) => {
    const existing = { id: 'task-1', title: 'Rail voucher', dueOn: '2027-01-19', done: false }

    const action = printTaskChanges({ document: voucher, existing, ...trip })

    assert.deepEqual(action, { action: 'none' })
  })

  test('removing the tag deletes an open print task', ({ assert }) => {
    const existing = { id: 'task-1', title: 'Rail voucher', dueOn: '2027-01-19', done: false }

    const action = printTaskChanges({ document: { ...voucher, tags: [] }, existing, ...trip })

    assert.deepEqual(action, { action: 'delete', taskId: 'task-1' })
  })

  test('done print task survives tag removal', ({ assert }) => {
    const existing = { id: 'task-1', title: 'Rail voucher', dueOn: '2027-01-19', done: true }

    assert.deepEqual(printTaskChanges({ document: { ...voucher, tags: [] }, existing, ...trip }), {
      action: 'none',
    })
    assert.deepEqual(
      printTaskChanges({ document: { ...voucher, deleted: true }, existing, ...trip }),
      { action: 'none' }
    )
  })

  test('a renamed document renames its open task', ({ assert }) => {
    const existing = { id: 'task-1', title: 'Old title', dueOn: '2027-01-19', done: false }

    const action = printTaskChanges({ document: voucher, existing, ...trip })

    assert.deepEqual(action, {
      action: 'update',
      taskId: 'task-1',
      changes: { title: 'Rail voucher' },
    })
  })

  test('once departure eve has passed the task is due today', ({ assert }) => {
    const action = printTaskChanges({
      document: voucher,
      existing: null,
      startsOn: '2027-01-20',
      today: '2027-01-21',
    })

    assert.equal(action.action === 'create' && action.task.dueOn, '2027-01-21')
  })
})
