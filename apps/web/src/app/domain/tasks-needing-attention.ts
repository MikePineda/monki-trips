import { taskUrgency, type IsoDate, type TripTask } from '@monkitrips/shared'

/**
 * The open `high` tasks already past their due date: what the mascot
 * worries about and what Today surfaces first (WP 2.4). Same rule as the
 * shared `hasOverdueHighTask`, returning the tasks themselves. Pure.
 */
export function tasksNeedingAttention<T extends Pick<TripTask, 'dueOn' | 'doneAt' | 'priority'>>(
  tasks: readonly T[],
  today: IsoDate
): T[] {
  return tasks.filter((task) => task.priority === 'high' && taskUrgency(task, today) === 'overdue')
}
