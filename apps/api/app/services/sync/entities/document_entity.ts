import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DocumentTag } from '@monkitrips/shared'
import type { DbRow, EntitySpec, FieldProblem } from '#services/sync/entity_spec'
import { printTaskChanges } from '#domain/print_tasks'
import { toWireValue } from '#services/sync/column_types'
import { documentChanges } from '#validators/sync/entities'

/**
 * Keeps the "print this" task of a document in step with its `print` tag:
 * one open task per document, deleted when the tag goes unless it is done.
 * Shared by push and the upload route.
 */
export async function syncPrintTask(
  trx: TransactionClientContract,
  document: DbRow,
  tripRow: DbRow,
  by: { userId: string; now: string; changedAt: number }
): Promise<void> {
  const existing = (await trx
    .from('tasks')
    .where('source_document_id', String(document.id))
    .where('origin', 'document')
    .whereNull('deleted_at')
    .first()) as DbRow | null
  const today = new Date(by.now).toISOString().slice(0, 10)
  const action = printTaskChanges({
    document: {
      id: String(document.id),
      title: String(document.title),
      tags: (document.tags as DocumentTag[]) ?? [],
      deleted: document.deleted_at !== null && document.deleted_at !== undefined,
    },
    existing: existing
      ? {
          id: String(existing.id),
          title: String(existing.title),
          dueOn: toWireValue('date', existing.due_on) as string | null,
          done: existing.done_at !== null,
        }
      : null,
    startsOn: toWireValue('date', tripRow.starts_on) as string,
    today,
  })
  const clock = (fields: string[]) =>
    JSON.stringify(Object.fromEntries(fields.map((field) => [field, by.changedAt])))
  switch (action.action) {
    case 'create':
      await trx.table('tasks').insert({
        trip_id: document.trip_id,
        title: action.task.title,
        title_key: action.task.titleKey,
        due_on: action.task.dueOn,
        priority: action.task.priority,
        origin: 'document',
        source_document_id: document.id,
        updated_by: by.userId,
        field_clock: clock(['title', 'dueOn', 'priority']),
      })
      return
    case 'update':
      await trx
        .from('tasks')
        .where('id', action.taskId)
        .update({
          ...(action.changes.title !== undefined ? { title: action.changes.title } : {}),
          ...(action.changes.dueOn !== undefined ? { due_on: action.changes.dueOn } : {}),
          updated_by: by.userId,
          field_clock: trx.raw('field_clock || ?::jsonb', [clock(Object.keys(action.changes))]),
        })
      return
    case 'delete':
      await trx
        .from('tasks')
        .where('id', action.taskId)
        .update({
          deleted_at: new Date(by.now),
          updated_by: by.userId,
          field_clock: trx.raw('field_clock || ?::jsonb', [clock(['deletedAt'])]),
        })
      return
    case 'none':
      return
  }
}

/**
 * Document metadata. Files are created by the upload route (which sets the
 * storage key, mime, size and hash); push edits their metadata and creates
 * links. The bytes never travel here. A `print` tag maintains a print task.
 */
export const documentEntity: EntitySpec = {
  entity: 'document',
  table: 'documents',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: documentChanges,
  requiredOnInsert: ['kind', 'title'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'eventId', column: 'event_id', type: 'text', writable: true, references: 'events' },
    { field: 'kind', column: 'kind', type: 'text', writable: true, immutable: true },
    { field: 'title', column: 'title', type: 'text', writable: true },
    { field: 'url', column: 'url', type: 'text', writable: true },
    { field: 'mime', column: 'mime', type: 'text', writable: false },
    { field: 'sizeBytes', column: 'size_bytes', type: 'int', writable: false },
    { field: 'sha256', column: 'sha256', type: 'text', writable: false },
    { field: 'tags', column: 'tags', type: 'textArray', writable: true },
    { field: 'availableOffline', column: 'available_offline', type: 'bool', writable: true },
    { field: 'uploadedBy', column: 'uploaded_by', type: 'text', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async derive(merged, ctx) {
    const problems: FieldProblem[] = []
    if (ctx.inserting && merged.kind === 'file') {
      // The bytes come first: POST /trips/:tripId/documents creates file documents.
      problems.push({ field: 'kind', rule: 'uploadRequired' })
    }
    if (merged.kind === 'link' && !merged.url) {
      problems.push({ field: 'url', rule: 'required' })
    }
    return { columns: {}, problems }
  },
  async afterWrite(ctx) {
    await syncPrintTask(ctx.trx, ctx.row, ctx.tripRow, {
      userId: ctx.userId,
      now: ctx.now,
      changedAt: ctx.changedAt,
    })
  },
}
