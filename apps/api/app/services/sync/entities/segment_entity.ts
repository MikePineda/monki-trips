import type { DbRow, EntitySpec, FieldProblem } from '#services/sync/entity_spec'
import { deriveInstant } from '#services/sync/entities/event_entity'
import {
  recomputeEventFromSegments,
  swapSegmentPosition,
  tombstoneWhere,
} from '#services/sync/table_writes'
import { segmentChanges } from '#validators/sync/entities'

/**
 * Legs of a transport event. Departure and arrival instants are derived
 * from the local times and zones; every write (and delete) recomputes the
 * parent event's start and end. A segment never moves to another event;
 * moving it onto a position another leg holds swaps the two.
 */
export const segmentEntity: EntitySpec = {
  entity: 'segment',
  table: 'event_segments',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: segmentChanges,
  requiredOnInsert: ['eventId', 'departsLocal', 'departsTz', 'arrivesLocal', 'arrivesTz'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    {
      field: 'eventId',
      column: 'event_id',
      type: 'text',
      writable: true,
      immutable: true,
      references: 'events',
    },
    { field: 'position', column: 'position', type: 'int', writable: true },
    { field: 'carrier', column: 'carrier', type: 'text', writable: true },
    { field: 'number', column: 'number', type: 'text', writable: true },
    { field: 'originName', column: 'origin_name', type: 'text', writable: true },
    { field: 'originCode', column: 'origin_code', type: 'text', writable: true },
    { field: 'originLat', column: 'origin_lat', type: 'decimal', writable: true },
    { field: 'originLng', column: 'origin_lng', type: 'decimal', writable: true },
    { field: 'destName', column: 'dest_name', type: 'text', writable: true },
    { field: 'destCode', column: 'dest_code', type: 'text', writable: true },
    { field: 'destLat', column: 'dest_lat', type: 'decimal', writable: true },
    { field: 'destLng', column: 'dest_lng', type: 'decimal', writable: true },
    { field: 'departsLocal', column: 'departs_local', type: 'localTime', writable: true },
    { field: 'departsTz', column: 'departs_tz', type: 'text', writable: true },
    { field: 'departsAt', column: 'departs_at', type: 'instant', writable: false },
    { field: 'arrivesLocal', column: 'arrives_local', type: 'localTime', writable: true },
    { field: 'arrivesTz', column: 'arrives_tz', type: 'text', writable: true },
    { field: 'arrivesAt', column: 'arrives_at', type: 'instant', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async derive(merged, ctx) {
    const problems: FieldProblem[] = []
    const columns: DbRow = {}
    const departs = deriveInstant(
      merged.departsLocal,
      merged.departsTz,
      'departsLocal',
      'departsTz',
      problems
    )
    const arrives = deriveInstant(
      merged.arrivesLocal,
      merged.arrivesTz,
      'arrivesLocal',
      'arrivesTz',
      problems
    )
    if (departs.at && arrives.at && arrives.at < departs.at) {
      problems.push({ field: 'arrivesLocal', rule: 'afterOrEqual' })
    }
    columns.departs_local = departs.local
    columns.departs_at = departs.at ? new Date(departs.at) : null
    columns.arrives_local = arrives.local
    columns.arrives_at = arrives.at ? new Date(arrives.at) : null
    if (problems.length === 0 && !ctx.inserting && typeof merged.position === 'number') {
      const [stored] = (await ctx.trx
        .from('event_segments')
        .where('id', String(merged.id))
        .select('position')) as { position: number }[]
      await swapSegmentPosition(
        ctx.trx,
        {
          id: String(merged.id),
          eventId: String(merged.eventId),
          from: Number(stored.position),
          to: merged.position,
        },
        { userId: ctx.userId, changedAt: ctx.changedAt }
      )
    }
    return { columns, problems }
  },
  async afterWrite(ctx) {
    if (ctx.op === 'delete') {
      await tombstoneWhere(ctx.trx, 'segment_seats', 'segment_id', String(ctx.row.id), {
        userId: ctx.userId,
        now: ctx.now,
        changedAt: ctx.changedAt,
      })
    }
    await recomputeEventFromSegments(ctx.trx, String(ctx.row.event_id))
  },
}
