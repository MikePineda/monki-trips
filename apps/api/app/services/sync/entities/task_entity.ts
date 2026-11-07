import { templateTitleKey } from '@monkitrips/shared'
import type { DbRow, EntitySpec, FieldProblem } from '#services/sync/entity_spec'
import { taskChanges } from '#validators/sync/entities'

/**
 * Tasks. `doneBy` follows `doneAt`: the account that marks a task done is
 * recorded, and cleared when it is reopened. A client creates its own
 * tasks (`manual`) or checklist items (`template`, with the item's key;
 * `titleKey` is derived from it); both are fixed once the row exists.
 * `document` and `ai` tasks and the source document are server-owned
 * (print tasks, accepted AI actions). A checklist item the trip already
 * has (same `templateItemKey`, made on another device or by the template
 * route) answers `duplicate` with the server's row instead of a second
 * row: the partial unique index on `(trip_id, template_item_key)` is the
 * referee when two inserts race.
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
    { field: 'titleKey', column: 'title_key', type: 'text', writable: true, immutable: true },
    { field: 'notes', column: 'notes', type: 'text', writable: true },
    { field: 'dueOn', column: 'due_on', type: 'date', writable: true },
    { field: 'priority', column: 'priority', type: 'text', writable: true },
    { field: 'doneAt', column: 'done_at', type: 'instant', writable: true },
    { field: 'doneBy', column: 'done_by', type: 'text', writable: false },
    { field: 'origin', column: 'origin', type: 'text', writable: true, immutable: true },
    { field: 'sourceDocumentId', column: 'source_document_id', type: 'text', writable: false },
    {
      field: 'templateItemKey',
      column: 'template_item_key',
      type: 'text',
      writable: true,
      immutable: true,
    },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async duplicateOf(changes, ctx) {
    const key = changes['templateItemKey']
    if (typeof key !== 'string') return null
    return (
      ((await ctx.trx
        .from('tasks')
        .where('trip_id', ctx.tripId)
        .where('template_item_key', key)
        .whereNull('deleted_at')
        .forUpdate()
        .first()) as DbRow | null) ?? null
    )
  },
  async derive(merged, ctx) {
    const columns: DbRow = {}
    const problems: FieldProblem[] = []
    if ('doneAt' in merged) {
      columns.done_by = merged.doneAt ? (merged.doneBy ?? ctx.userId) : null
    }
    if (ctx.inserting) {
      const origin = merged.origin === 'template' ? 'template' : 'manual'
      columns.origin = origin
      if (origin === 'template') {
        if (typeof merged.templateItemKey === 'string') {
          columns.title_key = templateTitleKey(merged.templateItemKey)
        } else {
          problems.push({ field: 'templateItemKey', rule: 'required' })
        }
      } else {
        for (const field of ['templateItemKey', 'titleKey'] as const) {
          if (merged[field] !== undefined && merged[field] !== null) {
            problems.push({ field, rule: 'templateOnly' })
          }
        }
      }
    }
    return { columns, problems }
  },
}
