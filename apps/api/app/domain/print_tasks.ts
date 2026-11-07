import { DateTime } from 'luxon'
import { PRINT_DOCUMENT_TASK_KEY, type DocumentTag } from '@monkitrips/shared'

/** The slice of a document the print rule reads. */
export interface PrintDocument {
  id: string
  title: string
  tags: readonly DocumentTag[]
  deleted: boolean
}

/** The open or done print task of that document, if one exists. */
export interface ExistingPrintTask {
  id: string
  title: string
  dueOn: string | null
  done: boolean
}

export type PrintTaskAction =
  | {
      action: 'create'
      task: { title: string; titleKey: string; dueOn: string; priority: 'normal' }
    }
  | { action: 'update'; taskId: string; changes: { title?: string; dueOn?: string } }
  | { action: 'delete'; taskId: string }
  | { action: 'none' }

export interface PrintTaskInput {
  document: PrintDocument
  existing: ExistingPrintTask | null
  /** The trip's departure date. */
  startsOn: string
  today: string
}

/**
 * A document tagged `print` gets one "print this" task, due the day before
 * departure (or today, once that day has passed), keyed by the document so
 * tagging twice keeps one task. Removing the tag, or deleting the document,
 * deletes the task unless it is already done: a printed page stays printed.
 * Mirrors the shared `print_tasks`.
 */
export function printTaskChanges(input: PrintTaskInput): PrintTaskAction {
  const wantsTask = !input.document.deleted && input.document.tags.includes('print')
  const { existing } = input
  if (!wantsTask) {
    if (existing && !existing.done) return { action: 'delete', taskId: existing.id }
    return { action: 'none' }
  }
  const dayBefore = DateTime.fromISO(input.startsOn, { zone: 'utc' })
    .minus({ days: 1 })
    .toISODate()!
  const dueOn = dayBefore < input.today ? input.today : dayBefore
  if (!existing) {
    return {
      action: 'create',
      task: {
        title: input.document.title,
        titleKey: PRINT_DOCUMENT_TASK_KEY,
        dueOn,
        priority: 'normal',
      },
    }
  }
  if (existing.done) return { action: 'none' }
  const changes: { title?: string; dueOn?: string } = {}
  if (existing.title !== input.document.title) changes.title = input.document.title
  if (existing.dueOn !== dueOn) changes.dueOn = dueOn
  return Object.keys(changes).length > 0
    ? { action: 'update', taskId: existing.id, changes }
    : { action: 'none' }
}
