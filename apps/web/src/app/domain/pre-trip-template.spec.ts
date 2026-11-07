import {
  PRE_TRIP_TEMPLATE,
  TEMPLATE_CATEGORIES,
  missingTemplateTasks,
  templateItem,
  templateTitleKey,
} from './pre-trip-template'

describe('pre-trip template', () => {
  it('covers documents, gear and the day before leaving', () => {
    const categories = new Set(PRE_TRIP_TEMPLATE.map((item) => item.category))

    expect([...categories].sort()).toEqual([...TEMPLATE_CATEGORIES].sort())
    expect(PRE_TRIP_TEMPLATE.map((item) => item.key)).toEqual([
      'documents.passport',
      'documents.visa',
      'documents.insurance',
      'gear.esim',
      'gear.adapter',
      'gear.cash',
      'before_leaving.print',
    ])
  })

  it('due dates count back from departure', () => {
    const tasks = missingTemplateTasks('2027-03-01', [])

    expect(tasks.find((task) => task.item.key === 'before_leaving.print')?.dueOn).toBe('2027-02-28')
    expect(tasks.find((task) => task.item.key === 'documents.passport')?.dueOn).toBe('2026-12-31')
  })

  it('template request is idempotent: items already present are not added again', () => {
    const first = missingTemplateTasks('2027-03-01', [])
    const again = missingTemplateTasks(
      '2027-03-01',
      first.map((task) => task.item.key)
    )
    const partial = missingTemplateTasks('2027-03-01', ['gear.esim', null, undefined])

    expect(first).toHaveLength(PRE_TRIP_TEMPLATE.length)
    expect(again).toEqual([])
    expect(partial.map((task) => task.item.key)).not.toContain('gear.esim')
    expect(partial).toHaveLength(PRE_TRIP_TEMPLATE.length - 1)
  })

  it('names the title key inside the tasks scope and finds an item by key', () => {
    expect(templateTitleKey('gear.cash')).toBe('template.gear.cash')
    expect(templateItem('gear.cash')?.category).toBe('gear')
    expect(templateItem('not.ours')).toBeUndefined()
  })
})
