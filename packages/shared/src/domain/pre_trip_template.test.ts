import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PRE_TRIP_TEMPLATE,
  PRE_TRIP_TEMPLATE_KEYS,
  TEMPLATE_CATEGORIES,
  missingTemplateTasks,
  templateItem,
  templateTitleKey,
} from './pre_trip_template.ts'

test('covers documents, gear and the day before leaving', () => {
  const categories = new Set(PRE_TRIP_TEMPLATE.map((item) => item.category))

  assert.deepEqual([...categories].sort(), [...TEMPLATE_CATEGORIES].sort())
  assert.deepEqual(PRE_TRIP_TEMPLATE_KEYS, [
    'documents.passport',
    'documents.visa',
    'documents.insurance',
    'gear.esim',
    'gear.adapter',
    'gear.cash',
    'before_leaving.print',
  ])
})

test('every item key starts with its category', () => {
  for (const item of PRE_TRIP_TEMPLATE) {
    assert.ok(item.key.startsWith(`${item.category}.`), item.key)
  }
})

test('due dates count back from departure', () => {
  const tasks = missingTemplateTasks('2027-03-01', [])

  assert.equal(tasks.find((task) => task.item.key === 'before_leaving.print')?.dueOn, '2027-02-28')
  assert.equal(tasks.find((task) => task.item.key === 'documents.passport')?.dueOn, '2026-12-31')
})

test('template request is idempotent: items already present are not added again', () => {
  const first = missingTemplateTasks('2027-03-01', [])
  const again = missingTemplateTasks(
    '2027-03-01',
    first.map((task) => task.item.key)
  )
  const partial = missingTemplateTasks('2027-03-01', ['gear.esim', null, undefined])

  assert.equal(first.length, PRE_TRIP_TEMPLATE.length)
  assert.deepEqual(again, [])
  assert.ok(!partial.map((task) => task.item.key).includes('gear.esim'))
  assert.equal(partial.length, PRE_TRIP_TEMPLATE.length - 1)
})

test('names the title key inside the tasks scope and finds an item by key', () => {
  assert.equal(templateTitleKey('gear.cash'), 'template.gear.cash')
  assert.equal(templateItem('gear.cash')?.category, 'gear')
  assert.equal(templateItem('not.ours'), undefined)
})
