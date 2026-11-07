import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DbRow } from '#services/sync/entity_spec'
import { localTimeToInstant } from '#domain/local_time'

/**
 * Writes the sync engine shares between entities: soft-delete cascades and
 * the recomputation of an event from its segments. Every write goes through
 * the table's `sync_stamp()` trigger, so each touched row gets its own
 * change stamp and reaches every client on the next pull.
 */

/** Tombstones the live rows of `table` whose `column` equals `value`; returns their ids. */
export async function tombstoneWhere(
  trx: TransactionClientContract,
  table: string,
  column: string,
  value: string,
  by: { userId: string; now: string; changedAt: number }
): Promise<string[]> {
  const rows = (await trx
    .from(table)
    .where(column, value)
    .whereNull('deleted_at')
    .select('id')) as { id: string }[]
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  await trx
    .from(table)
    .whereIn('id', ids)
    .update({
      deleted_at: new Date(by.now),
      updated_by: by.userId,
      field_clock: trx.raw(`field_clock || ?::jsonb`, [
        JSON.stringify({ deletedAt: by.changedAt }),
      ]),
    })
  return ids
}

/** Tombstones an event's segments and their seats. */
export async function tombstoneEventChildren(
  trx: TransactionClientContract,
  eventId: string,
  by: { userId: string; now: string; changedAt: number }
): Promise<void> {
  const segmentIds = await tombstoneWhere(trx, 'event_segments', 'event_id', eventId, by)
  for (const segmentId of segmentIds) {
    await tombstoneWhere(trx, 'segment_seats', 'segment_id', segmentId, by)
  }
}

/**
 * When an event has live segments they drive its start and end: the first
 * departure and the last arrival, zones included. Without segments the
 * event keeps whatever it has.
 */
export async function recomputeEventFromSegments(
  trx: TransactionClientContract,
  eventId: string
): Promise<void> {
  const segments = (await trx
    .from('event_segments')
    .where('event_id', eventId)
    .whereNull('deleted_at')
    .orderBy('position', 'asc')
    .orderBy('departs_at', 'asc')
    .select(
      'departs_local',
      'departs_tz',
      'departs_at',
      'arrives_local',
      'arrives_tz',
      'arrives_at'
    )) as DbRow[]
  if (segments.length === 0) return
  const first = segments[0]
  const last = segments[segments.length - 1]
  const departs = localTimeToInstant(wall(first.departs_local), String(first.departs_tz))
  await trx
    .from('events')
    .where('id', eventId)
    .update({
      starts_local: first.departs_local,
      start_tz: first.departs_tz,
      starts_at: first.departs_at,
      starts_on: departs.ok ? departs.on : null,
      ends_local: last.arrives_local,
      end_tz: last.arrives_tz,
      ends_at: last.arrives_at,
    })
}

/** A `timestamp without time zone` value back to `YYYY-MM-DDTHH:mm:ss`. */
function wall(value: unknown): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }
  return String(value).replace(' ', 'T')
}

/** The id of a live row of `table` in `tripId`, or null. */
export async function liveRowInTrip(
  trx: TransactionClientContract | QueryClientContract,
  table: string,
  id: string,
  tripId: string
): Promise<DbRow | null> {
  const row = await trx
    .from(table)
    .where('id', id)
    .where('trip_id', tripId)
    .whereNull('deleted_at')
    .first()
  return (row as DbRow | null) ?? null
}
