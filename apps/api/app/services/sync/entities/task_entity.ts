import type { DbRow, EntitySpec } from '#services/sync/entity_spec'
import { taskChanges } from '#validators/sync/entities'

/**
 * Tasks. `doneBy` follows `doneAt`: the account that marks a task done is
 * recorded, and cleared when it is reopened. Origin, template keys and the
 * source document are server-owned (print tasks, the template route).
 */
export const taskEntity: EntitySpec = {
  entity: 'task',
  table: 'tasks',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: taskChanges,
  requiredOnInsert: ['title'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'eventId', column: 'event_id', type: 'text', writable: true, references: 'events' },
    { field: 'title', column: 'title', type: 'text', writable: true },
    { field: 'titleKey', column: 'title_key', type: 'text', writable: false },
    { field: 'notes', column: 'notes', type: 'text', writable: true },
    { field: 'dueOn', column: 'due_on', type: 'date', writable: true },
    { field: 'priority', column: 'priority', type: 'text', writable: true },
    { field: 'doneAt', column: 'done_at', type: 'instant', writable: true },
    { field: 'doneBy', column: 'done_by', type: 'text', writable: false },
    { field: 'origin', column: 'origin', type: 'text', writable: false },
    { field: 'sourceDocumentId', column: 'source_document_id', type: 'text', writable: false },
    { field: 'templateItemKey', column: 'template_item_key', type: 'text', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async derive(merged, ctx) {
    const columns: DbRow = {}
    if ('doneAt' in merged) {
      columns.done_by = merged.doneAt ? (merged.doneBy ?? ctx.userId) : null
    }
    if (ctx.inserting) columns.origin = 'manual'
    return { columns, problems: [] }
  },
}
