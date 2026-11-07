/** Priority of a task, mirrored by the CHECK constraint on `tasks.priority`. */
export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]

/**
 * Where a task came from, mirrored by the CHECK constraint on `tasks.origin`.
 * `document` tasks are the "print this" tasks a `print` tag creates;
 * `template` tasks come from the pre-trip checklist.
 */
export const TASK_ORIGINS = ['manual', 'template', 'document', 'ai'] as const

export type TaskOrigin = (typeof TASK_ORIGINS)[number]

/** Translation key of the "print this document" task, rendered with the document title. */
export const PRINT_DOCUMENT_TASK_KEY = 'print_document'

/**
 * A task as the API returns it. `titleKey` names a translation (the client
 * renders it with `title` as parameter) for tasks the server creates, so no
 * user-facing copy is stored in one language.
 */
export interface Task {
  id: string
  tripId: string
  eventId: string | null
  title: string
  titleKey: string | null
  notes: string | null
  dueOn: string | null
  priority: TaskPriority
  doneAt: string | null
  doneBy: string | null
  origin: TaskOrigin
  sourceDocumentId: string | null
  templateItemKey: string | null
  deletedAt: string | null
  updatedAt: string
}
