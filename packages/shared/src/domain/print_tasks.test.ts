import { test } from 'node:test'
import assert from 'node:assert/strict'
import { printTaskDueOn, reconcilePrintTask } from './print_tasks.ts'
import type { TripDocument } from './trip_document.ts'
import type { TripTask } from './trip_task.ts'

const voucher: TripDocument = {
  id: 'doc-voucher',
  eventId: 'event-ferry',
  title: 'Ferry voucher',
  tags: ['print'],
  availableOffline: true,
}

const openTask: TripTask = {
  id: 'task-print',
  title: 'Ferry voucher',
  titleKey: 'tasks.print_document',
  dueOn: '2026-01-09',
  priority: 'normal',
  doneAt: null,
  origin: 'document',
  sourceDocumentId: 'doc-voucher',
}

test('print tag creates one print task due the day before departure', () => {
  const result = reconcilePrintTask({
    document: voucher,
    tasks: [],
    tripStartsOn: '2026-01-10',
    today: '2025-12-20',
  })
  assert.deepEqual(result, {
    create: {
      title: 'Ferry voucher',
      titleKey: 'tasks.print_document',
      origin: 'document',
      sourceDocumentId: 'doc-voucher',
      eventId: 'event-ferry',
      dueOn: '2026-01-09',
      priority: 'normal',
    },
    deleteTaskIds: [],
  })
})

test('adding the tag twice keeps one task', () => {
  const result = reconcilePrintTask({
    document: voucher,
    tasks: [openTask],
    tripStartsOn: '2026-01-10',
    today: '2025-12-20',
  })
  assert.deepEqual(result, { create: null, deleteTaskIds: [] })
})

test('removing the tag deletes an open print task', () => {
  const result = reconcilePrintTask({
    document: { ...voucher, tags: ['show_on_phone'] },
    tasks: [openTask, { ...openTask, id: 'task-other', origin: 'manual', sourceDocumentId: null }],
    tripStartsOn: '2026-01-10',
    today: '2025-12-20',
  })
  assert.deepEqual(result, { create: null, deleteTaskIds: ['task-print'] })
})

test('done print task survives tag removal', () => {
  const result = reconcilePrintTask({
    document: { ...voucher, tags: [] },
    tasks: [{ ...openTask, doneAt: '2026-01-02T10:00:00Z' }],
    tripStartsOn: '2026-01-10',
    today: '2026-01-05',
  })
  assert.deepEqual(result, { create: null, deleteTaskIds: [] })
})

test('a deleted document behaves like an untagged one', () => {
  const result = reconcilePrintTask({
    document: { ...voucher, deletedAt: '2026-01-03T09:00:00Z' },
    tasks: [openTask],
    tripStartsOn: '2026-01-10',
    today: '2026-01-05',
  })
  assert.deepEqual(result, { create: null, deleteTaskIds: ['task-print'] })
})

test('a document tagged on the eve of departure or later is due today', () => {
  assert.equal(printTaskDueOn('2026-01-10', '2025-12-20'), '2026-01-09')
  assert.equal(printTaskDueOn('2026-01-10', '2026-01-09'), '2026-01-09')
  assert.equal(printTaskDueOn('2026-01-10', '2026-01-10'), '2026-01-10')
  assert.equal(printTaskDueOn('2026-01-10', '2026-01-15'), '2026-01-15')
})
