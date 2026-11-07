/**
 * A document tagged `print` owns one task: "Print {title}", `origin:
 * document`, due the day before departure (or today, when departure is
 * closer than that). Tagging twice keeps the one task; removing the tag (or
 * deleting the document) removes the task while it is still open; a done
 * task is history and stays. The reconciliation is pure: it says what to
 * create and what to delete, the caller assigns ids and writes.
 */
import { addDays, compareIsoDate, type IsoDate } from './iso_date.ts'
import { hasTag, type TripDocument } from './trip_document.ts'
import { isDone, type TripTask } from './trip_task.ts'

/** i18n key of the generated title; `title` carries the document's title for interpolation. */
export const PRINT_TASK_TITLE_KEY = 'tasks.print_document'

export interface PrintTaskDraft {
  title: string
  titleKey: typeof PRINT_TASK_TITLE_KEY
  origin: 'document'
  sourceDocumentId: string
  eventId: string | null
  dueOn: IsoDate
  priority: 'normal'
}

export interface PrintTaskReconciliation {
  /** The task to create, or null when the document already has one or needs none. */
  create: PrintTaskDraft | null
  /** Open print tasks of this document to delete. */
  deleteTaskIds: string[]
}

export interface PrintTasksInput {
  document: TripDocument
  /** Tasks of the trip (any origin; the others are ignored). */
  tasks: readonly TripTask[]
  tripStartsOn: IsoDate
  today: IsoDate
}

/** The day before departure, or today when departure is tomorrow or closer. */
export function printTaskDueOn(tripStartsOn: IsoDate, today: IsoDate): IsoDate {
  const eve = addDays(tripStartsOn, -1)
  return compareIsoDate(eve, today) < 0 ? today : eve
}

export function reconcilePrintTask(input: PrintTasksInput): PrintTaskReconciliation {
  const { document } = input
  const owned = input.tasks.filter(
    (task) => task.origin === 'document' && task.sourceDocumentId === document.id
  )
  const wantsTask = hasTag(document, 'print') && !document.deletedAt
  if (wantsTask) {
    if (owned.length > 0) {
      return { create: null, deleteTaskIds: [] }
    }
    return {
      create: {
        title: document.title,
        titleKey: PRINT_TASK_TITLE_KEY,
        origin: 'document',
        sourceDocumentId: document.id,
        eventId: document.eventId,
        dueOn: printTaskDueOn(input.tripStartsOn, input.today),
        priority: 'normal',
      },
      deleteTaskIds: [],
    }
  }
  return {
    create: null,
    deleteTaskIds: owned.filter((task) => !isDone(task)).map((task) => task.id),
  }
}
