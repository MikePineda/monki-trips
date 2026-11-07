import type { TripTaskRow } from '@monkitrips/shared'
import type { TaskRecord } from './records'

/**
 * The device's row for a task the API returned. Pure. Fields the API does
 * not fill yet for client-made rows (`titleKey`, `templateItemKey` and the
 * `template` origin of a checklist item) keep the device's value when the
 * server answers null: the template route of the plan is still an API gap,
 * so a checklist item would otherwise turn into a plain task after sync.
 */
export function toTaskRecord(row: TripTaskRow, local?: TaskRecord): TaskRecord {
  const templateItemKey = row.templateItemKey ?? local?.templateItemKey ?? null
  return {
    id: row.id,
    tripId: row.tripId,
    eventId: row.eventId ?? null,
    title: row.title,
    titleKey: row.titleKey ?? local?.titleKey ?? null,
    notes: row.notes ?? null,
    dueOn: row.dueOn,
    priority: row.priority,
    doneAt: row.doneAt,
    doneBy: row.doneBy ?? null,
    origin: templateItemKey && row.origin === 'manual' ? 'template' : row.origin,
    sourceDocumentId: row.sourceDocumentId ?? null,
    templateItemKey,
    updatedAt: row.updatedAt,
  }
}
