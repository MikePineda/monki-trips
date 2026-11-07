import type { DbRow, EntitySpec, FieldProblem } from '#services/sync/entity_spec'
import { localTimeToInstant } from '#domain/local_time'
import { recomputeEventFromSegments, tombstoneEventChildren } from '#services/sync/table_writes'
import { eventChanges } from '#validators/sync/entities'

/**
 * Derives one `*_at` instant and its date from a local time and zone, or
 * reports the problem on the local-time field.
 */
export function deriveInstant(
  local: unknown,
  zone: unknown,
  localField: string,
  zoneField: string,
  problems: FieldProblem[]
): { at: string | null; on: string | null; local: string | null } {
  if (local === null || local === undefined) return { at: null, on: null, local: null }
  if (typeof zone !== 'string') {
    problems.push({ field: zoneField, rule: 'required' })
    return { at: null, on: null, local: null }
  }
  const derived = localTimeToInstant(String(local), zone)
  if (!derived.ok) {
    problems.push({
      field: derived.reason === 'invalid_zone' ? zoneField : localField,
      rule: derived.reason === 'nonexistent' ? 'nonexistentLocalTime' : 'regex',
    })
    return { at: null, on: null, local: null }
  }
  return { at: derived.at, on: derived.on, local: derived.local }
}

/**
 * Itinerary events. The client sends local times and zones; the server
 * derives `startsAt`, `startsOn` and `endsAt`. A nonexistent local time
 * (a daylight-saving gap) is a validation error; an ambiguous one is the
 * earlier instant. When the event has segments, they win over the values a
 * client sends. Deleting an event tombstones its segments and seats.
 */
export const eventEntity: EntitySpec = {
  entity: 'event',
  table: 'events',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: eventChanges,
  requiredOnInsert: ['kind', 'title'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'stopId', column: 'stop_id', type: 'text', writable: true, references: 'stops' },
    { field: 'kind', column: 'kind', type: 'text', writable: true },
    { field: 'title', column: 'title', type: 'text', writable: true },
    { field: 'status', column: 'status', type: 'text', writable: true },
    { field: 'startsLocal', column: 'starts_local', type: 'localTime', writable: true },
    { field: 'startTz', column: 'start_tz', type: 'text', writable: true },
    { field: 'startsAt', column: 'starts_at', type: 'instant', writable: false },
    { field: 'startsOn', column: 'starts_on', type: 'date', writable: false },
    { field: 'endsLocal', column: 'ends_local', type: 'localTime', writable: true },
    { field: 'endTz', column: 'end_tz', type: 'text', writable: true },
    { field: 'endsAt', column: 'ends_at', type: 'instant', writable: false },
    { field: 'placeName', column: 'place_name', type: 'text', writable: true },
    { field: 'address', column: 'address', type: 'text', writable: true },
    { field: 'addressLocal', column: 'address_local', type: 'text', writable: true },
    { field: 'lat', column: 'lat', type: 'decimal', writable: true },
    { field: 'lng', column: 'lng', type: 'decimal', writable: true },
    { field: 'providerName', column: 'provider_name', type: 'text', writable: true },
    { field: 'bookingCode', column: 'booking_code', type: 'text', writable: true },
    { field: 'costMinor', column: 'cost_minor', type: 'int', writable: true },
    { field: 'costCurrency', column: 'cost_currency', type: 'text', writable: true },
    { field: 'notes', column: 'notes', type: 'text', writable: true },
    { field: 'leaveBufferMin', column: 'leave_buffer_min', type: 'int', writable: true },
    { field: 'travelMin', column: 'travel_min', type: 'int', writable: true },
    { field: 'coversNight', column: 'covers_night', type: 'bool', writable: true },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async derive(merged, ctx) {
    const problems: FieldProblem[] = []
    const columns: DbRow = {}
    const hasCost = merged.costMinor !== null && merged.costMinor !== undefined
    const hasCurrency = merged.costCurrency !== null && merged.costCurrency !== undefined
    if (hasCost !== hasCurrency) {
      problems.push({ field: hasCost ? 'costCurrency' : 'costMinor', rule: 'required' })
    }
    const endTz = merged.endTz ?? merged.startTz
    const start = deriveInstant(
      merged.startsLocal,
      merged.startTz,
      'startsLocal',
      'startTz',
      problems
    )
    const end = deriveInstant(merged.endsLocal, endTz, 'endsLocal', 'endTz', problems)
    if (start.at && end.at && end.at < start.at) {
      problems.push({ field: 'endsLocal', rule: 'afterOrEqual' })
    }
    columns.starts_local = start.local
    columns.starts_at = start.at ? new Date(start.at) : null
    columns.starts_on = start.on
    columns.ends_local = end.local
    columns.ends_at = end.at ? new Date(end.at) : null
    if (!ctx.inserting) {
      // Live segments own the start and end: leave them to afterWrite.
      const segment = await ctx.trx
        .from('event_segments')
        .where('event_id', String(merged.id))
        .whereNull('deleted_at')
        .first()
      if (segment) {
        for (const key of ['starts_local', 'starts_at', 'starts_on', 'ends_local', 'ends_at']) {
          delete columns[key]
        }
      }
    }
    return { columns, problems }
  },
  async afterWrite(ctx) {
    if (ctx.op === 'delete') {
      await tombstoneEventChildren(ctx.trx, String(ctx.row.id), {
        userId: ctx.userId,
        now: ctx.now,
        changedAt: ctx.changedAt,
      })
      return
    }
    if (!ctx.inserting) await recomputeEventFromSegments(ctx.trx, String(ctx.row.id))
  },
}
