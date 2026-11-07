/**
 * Tasks on the wire. The entity shape and its enums (`TripTask`,
 * `TASK_PRIORITIES`, `TASK_ORIGINS`) live in `domain/trip_task.ts`.
 */
import { PRINT_TASK_TITLE_KEY } from './domain/print_tasks.ts'
import type { TripTask } from './domain/trip_task.ts'
import type { IsoInstant } from './domain/zoned_instant.ts'

/** Translation key of the "print this document" task, rendered with the document title (the domain's key). */
export const PRINT_DOCUMENT_TASK_KEY: typeof PRINT_TASK_TITLE_KEY = PRINT_TASK_TITLE_KEY

/**
 * A task as the API returns it: the domain's `TripTask` with every field
 * present plus the stored columns. `titleKey` names a translation (the
 * client renders it with `title` as parameter) for tasks the server
 * creates, so no user-facing copy is stored in one language.
 */
export interface TripTaskRow extends Required<TripTask> {
  tripId: string
  notes: string | null
  doneBy: string | null
  templateItemKey: string | null
  deletedAt: IsoInstant | null
  updatedAt: IsoInstant
}

/**
 * What `POST /trips/:tripId/tasks/from-template` answers: the trip's live
 * checklist (every task with a `templateItemKey`, in template order) and
 * how many items this request created (0 when the checklist was complete).
 */
export interface TemplateTasksResult {
  tasks: TripTaskRow[]
  created: number
}
