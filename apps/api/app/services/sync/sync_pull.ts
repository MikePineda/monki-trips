import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import {
  SYNC_PULL_MAX_LIMIT,
  SYNC_PURGE_HORIZON_DAYS,
  type SyncChange,
  type SyncEntity,
  type SyncPullOutput,
} from '@monkitrips/shared'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { TripMembership } from '#services/trip_membership'
import { ApiException } from '#exceptions/api_exception'
import {
  decodeSyncCursor,
  encodeSyncCursor,
  isCursorExpired,
  type SyncCursor,
} from '#domain/sync_cursor'
import { PULL_ENTITIES } from '#services/sync/entity_registry'
import type { DbRow } from '#services/sync/entity_spec'
import { rowToWire } from '#services/sync/row_wire'

/** The largest bigint, as text: a cursor at this sequence sits after every row of its transaction. */
const MAX_SEQ = '9223372036854775807'

interface ChangePointer {
  entity: SyncEntity
  id: string
  xid: string
  seq: string
}

/**
 * `GET /sync/pull`: the global change order across every trip the person is
 * a live member of. Rows are ordered by `(change_xid, change_seq)`, the
 * stamp the `sync_stamp()` trigger gave them. Two guards keep the order
 * safe to resume from:
 *
 * - only rows whose transaction is below the snapshot's `xmin` are
 *   delivered (`change_xid < pg_snapshot_xmin(pg_current_snapshot())`): a
 *   transaction still in flight with a lower id can commit later with rows
 *   that sort before the cursor, and would be skipped otherwise;
 * - rows written by the calling transaction itself are not concurrent and
 *   are delivered too (`change_xid = pg_current_xact_id_if_assigned()`):
 *   a read-only pull has no transaction id, so in production the clause is
 *   inert; it keeps pull observable inside a test's wrapping transaction.
 *
 * Without a cursor the answer is a snapshot of every live row; with one,
 * everything changed after it, tombstones included. The cursor carries the
 * last stamp delivered and its issue time; one older than the purge
 * horizon answers 410 `E_SYNC_CURSOR_EXPIRED`.
 */
@inject()
export class SyncPull {
  constructor(
    private readonly clock: Clock,
    private readonly membership: TripMembership
  ) {}

  async pull(user: User, input: { cursor?: string; limit?: number }): Promise<SyncPullOutput> {
    const now = this.clock.now().getTime()
    const limit = Math.min(input.limit ?? SYNC_PULL_MAX_LIMIT, SYNC_PULL_MAX_LIMIT)
    let cursor: SyncCursor | null = null
    if (input.cursor !== undefined) {
      cursor = decodeSyncCursor(input.cursor)
      if (!cursor || isCursorExpired(cursor, now, SYNC_PURGE_HORIZON_DAYS)) {
        throw new ApiException('E_SYNC_CURSOR_EXPIRED')
      }
    }

    const memberships = await this.membership.tripsOf(user)
    const tripIds = memberships.map((m) => m.tripId)
    if (tripIds.length === 0) {
      return {
        changes: [],
        tripIds,
        cursor: cursor ? input.cursor! : encodeSyncCursor({ xid: '0', seq: '0', issuedAt: now }),
        hasMore: false,
      }
    }

    const { pointers, xmin } = await this.pointers(tripIds, cursor, limit + 1)
    const hasMore = pointers.length > limit
    const page = hasMore ? pointers.slice(0, limit) : pointers
    const changes = await this.rows(page, tripIds)

    const last = page.at(-1)
    const horizon: SyncCursor = { xid: String(BigInt(xmin) - 1n), seq: MAX_SEQ, issuedAt: now }
    let next: SyncCursor
    if (hasMore && last) {
      next = { xid: last.xid, seq: last.seq, issuedAt: now }
    } else if (last && compareStamps(last, horizon) > 0) {
      next = { xid: last.xid, seq: last.seq, issuedAt: now }
    } else {
      next = horizon
    }
    if (cursor && compareStamps(next, cursor) < 0) next = { ...cursor, issuedAt: now }

    return { changes, tripIds, cursor: encodeSyncCursor(next), hasMore }
  }

  /** The next `limit` change stamps across every syncable table of the trips, in order. */
  private async pointers(
    tripIds: string[],
    cursor: SyncCursor | null,
    limit: number
  ): Promise<{ pointers: ChangePointer[]; xmin: string }> {
    const tripList = tripIds.map(() => '?').join(', ')
    const parts: string[] = []
    const bindings: unknown[] = []
    for (const [entity, spec] of Object.entries(PULL_ENTITIES)) {
      parts.push(
        `select '${entity}'::text as entity, ${spec.idColumn}::text as id, change_xid, change_seq, deleted_at
         from ${spec.table} where ${spec.tripColumn} in (${tripList})`
      )
      bindings.push(...tripIds)
    }
    const conditions = [
      `(c.change_xid < h.xmin or c.change_xid = pg_current_xact_id_if_assigned())`,
    ]
    if (cursor) {
      conditions.push(`(c.change_xid, c.change_seq) > (?::xid8, ?::bigint)`)
      bindings.push(cursor.xid, cursor.seq)
    } else {
      conditions.push(`c.deleted_at is null`)
    }
    bindings.push(limit)
    const { rows } = await db.rawQuery(
      `with h as (select pg_snapshot_xmin(pg_current_snapshot()) as xmin),
            c as (${parts.join(' union all ')})
       select h.xmin::text as xmin, c.entity, c.id, c.change_xid::text as xid, c.change_seq::text as seq
       from h left join c on ${conditions.join(' and ')}
       order by c.change_xid nulls last, c.change_seq nulls last
       limit ?`,
      bindings
    )
    const typed = rows as {
      xmin: string
      entity: SyncEntity
      id: string | null
      xid: string
      seq: string
    }[]
    const xmin = typed[0]?.xmin ?? (await this.currentXmin())
    const pointers = typed
      .filter((row) => row.id !== null)
      .map((row) => ({ entity: row.entity, id: row.id!, xid: row.xid, seq: row.seq }))
    return { pointers, xmin }
  }

  private async currentXmin(): Promise<string> {
    const { rows } = await db.rawQuery(
      `select pg_snapshot_xmin(pg_current_snapshot())::text as xmin`
    )
    return rows[0].xmin as string
  }

  /** The rows behind the pointers, in pointer order, as wire changes. */
  private async rows(pointers: ChangePointer[], tripIds: string[]): Promise<SyncChange[]> {
    const byEntity = new Map<SyncEntity, string[]>()
    for (const pointer of pointers) {
      byEntity.set(pointer.entity, [...(byEntity.get(pointer.entity) ?? []), pointer.id])
    }
    const rows = new Map<string, Record<string, unknown>>()
    for (const [entity, ids] of byEntity) {
      const spec = PULL_ENTITIES[entity]
      let query = db
        .from(`${spec.table} as t`)
        .whereIn(`t.${spec.idColumn}`, ids)
        .whereIn(`t.${spec.tripColumn}`, tripIds)
        .select('t.*')
      if (entity === 'member') {
        query = query
          .leftJoin('users as u', 'u.id', 't.user_id')
          .select(db.raw('coalesce(u.display_name, ?) as display_name', ['']))
      }
      for (const row of (await query) as DbRow[]) {
        rows.set(`${entity}:${row[spec.idColumn]}`, rowToWire(spec, row))
      }
    }
    const changes: SyncChange[] = []
    for (const pointer of pointers) {
      const row = rows.get(`${pointer.entity}:${pointer.id}`)
      if (row) changes.push({ entity: pointer.entity, row } as unknown as SyncChange)
    }
    return changes
  }
}

/** Orders two stamps by `(xid, seq)`. */
function compareStamps(a: { xid: string; seq: string }, b: { xid: string; seq: string }): number {
  const xid = BigInt(a.xid) - BigInt(b.xid)
  if (xid !== 0n) return xid < 0n ? -1 : 1
  const seq = BigInt(a.seq) - BigInt(b.seq)
  return seq === 0n ? 0 : seq < 0n ? -1 : 1
}
