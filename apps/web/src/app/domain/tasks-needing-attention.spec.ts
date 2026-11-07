import { hasOverdueHighTask, type TripTask } from '@monkitrips/shared'
import { tasksNeedingAttention } from './tasks-needing-attention'

function task(overrides: Partial<TripTask>): TripTask {
  return {
    id: 'k',
    title: 'Synthetic',
    dueOn: null,
    priority: 'normal',
    doneAt: null,
    origin: 'manual',
    ...overrides,
  }
}

describe('tasksNeedingAttention', () => {
  const today = '2027-01-10'
  const tasks = [
    task({ id: 'late-high', dueOn: '2027-01-09', priority: 'high' }),
    task({ id: 'late-normal', dueOn: '2027-01-09', priority: 'normal' }),
    task({
      id: 'done-high',
      dueOn: '2027-01-01',
      priority: 'high',
      doneAt: '2027-01-02T00:00:00Z',
    }),
    task({ id: 'today-high', dueOn: '2027-01-10', priority: 'high' }),
    task({ id: 'undated-high', priority: 'high' }),
  ]

  it('keeps only open high tasks that are overdue', () => {
    expect(tasksNeedingAttention(tasks, today).map((item) => item.id)).toEqual(['late-high'])
  })

  it('agrees with the shared mascot rule', () => {
    expect(tasksNeedingAttention(tasks, today).length > 0).toBe(hasOverdueHighTask(tasks, today))
    expect(tasksNeedingAttention(tasks.slice(1), today)).toEqual([])
    expect(hasOverdueHighTask(tasks.slice(1), today)).toBe(false)
  })
})
