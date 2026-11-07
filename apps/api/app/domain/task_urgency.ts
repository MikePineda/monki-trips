import { DateTime } from 'luxon'
import type { TaskUrgency } from '@monkitrips/shared'

/**
 * How pressing an open task is on `today` (`YYYY-MM-DD`): overdue, due
 * today, due within seven days, later, or undated. Done tasks are not
 * urgent at all: callers filter them out first.
 */
export function taskUrgency(dueOn: string | null, today: string): TaskUrgency {
  if (!dueOn) return 'no_date'
  if (dueOn < today) return 'overdue'
  if (dueOn === today) return 'today'
  const days = DateTime.fromISO(dueOn, { zone: 'utc' }).diff(
    DateTime.fromISO(today, { zone: 'utc' }),
    'days'
  ).days
  return days <= 7 ? 'this_week' : 'later'
}
