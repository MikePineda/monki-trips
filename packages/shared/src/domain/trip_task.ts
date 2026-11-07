/**
 * A task of the trip, the row of `tasks` as the domain reads it. `titleKey`
 * names an i18n key for generated tasks (template, document) so no user
 * facing copy is hardcoded; `title` then carries the interpolated value.
 */
import type { IsoDate } from './iso_date.ts'
import type { IsoInstant } from './zoned_instant.ts'

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_ORIGINS = ['manual', 'template', 'document', 'ai'] as const

export type TaskOrigin = (typeof TASK_ORIGINS)[number]

export interface TripTask {
  id: string
  title: string
  titleKey?: string | null
  dueOn: IsoDate | null
  priority: TaskPriority
  doneAt: IsoInstant | null
  origin: TaskOrigin
  sourceDocumentId?: string | null
  eventId?: string | null
}

export function isDone(task: Pick<TripTask, 'doneAt'>): boolean {
  return task.doneAt !== null && task.doneAt !== undefined
}
