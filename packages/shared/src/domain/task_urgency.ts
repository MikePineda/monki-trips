/**
 * Buckets a task by how soon it is due, relative to `today`: `overdue`,
 * `today`, `this_week` (within the next seven days), `later`, `no_date`.
 * Done tasks have no urgency and are left out of the groups.
 */
import { daysBetween, type IsoDate } from './iso_date.ts'
import { isDone, type TripTask } from './trip_task.ts'

export const TASK_URGENCIES = ['overdue', 'today', 'this_week', 'later', 'no_date'] as const

export type TaskUrgency = (typeof TASK_URGENCIES)[number]

/** Days ahead, today excluded, that still count as "this week". */
export const THIS_WEEK_DAYS = 7

export function taskUrgency(
  task: Pick<TripTask, 'dueOn' | 'doneAt'>,
  today: IsoDate
): TaskUrgency | null {
  if (isDone(task)) {
    return null
  }
  if (task.dueOn === null) {
    return 'no_date'
  }
  const days = daysBetween(today, task.dueOn)
  if (days < 0) {
    return 'overdue'
  }
  if (days === 0) {
    return 'today'
  }
  return days <= THIS_WEEK_DAYS ? 'this_week' : 'later'
}

/** Open tasks grouped by urgency, each group in due-date order (undated keep their input order). */
export function groupTasksByUrgency<T extends Pick<TripTask, 'dueOn' | 'doneAt'>>(
  tasks: readonly T[],
  today: IsoDate
): Record<TaskUrgency, T[]> {
  const groups: Record<TaskUrgency, T[]> = {
    overdue: [],
    today: [],
    this_week: [],
    later: [],
    no_date: [],
  }
  for (const task of tasks) {
    const urgency = taskUrgency(task, today)
    if (urgency) {
      groups[urgency].push(task)
    }
  }
  for (const urgency of TASK_URGENCIES) {
    groups[urgency].sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? ''))
  }
  return groups
}

/** True when an open `high` task is already late. */
export function hasOverdueHighTask(tasks: readonly TripTask[], today: IsoDate): boolean {
  return tasks.some((task) => task.priority === 'high' && taskUrgency(task, today) === 'overdue')
}
