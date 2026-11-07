import type { VineValidator } from '@vinejs/vine'
import type { SchemaTypes } from '@vinejs/vine/types'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { SyncEntity } from '@monkitrips/shared'
import type { ColumnType } from '#services/sync/column_types'

/**
 * A raw database row, snake_case, as `pg` returns it. The columns the engine
 * reads by name are declared so they can be accessed with a dot under
 * `noPropertyAccessFromIndexSignature` (the web compiles these files through
 * the typed client manifest); anything else goes through the index.
 */
export interface DbRow {
  [column: string]: unknown
  id?: unknown
  trip_id?: unknown
  event_id?: unknown
  expense_id?: unknown
  user_id?: unknown
  deleted_at?: unknown
  field_clock?: unknown
  content?: unknown
  kind?: unknown
  url?: unknown
  storage_key?: unknown
  mime?: unknown
  title?: unknown
  tags?: unknown
  due_on?: unknown
  done_at?: unknown
  starts_on?: unknown
  base_currency?: unknown
  key?: unknown
  name?: unknown
  departs_local?: unknown
  departs_tz?: unknown
  departs_at?: unknown
  arrives_local?: unknown
  arrives_tz?: unknown
  arrives_at?: unknown
  starts_local?: unknown
  start_tz?: unknown
  starts_at?: unknown
  ends_local?: unknown
  end_tz?: unknown
  ends_at?: unknown
  created_by?: unknown
  currency?: unknown
  spent_on?: unknown
  fx_rate?: unknown
  fx_source?: unknown
  fx_rate_date?: unknown
  base_amount_minor?: unknown
  done_by?: unknown
  origin?: unknown
  title_key?: unknown
  template_item_key?: unknown
  schema_version?: unknown
}

/** Wire fields the derivation hooks read by name; the rest of a merged row goes through the index. */
export type MergedRow = Record<string, unknown> &
  Partial<
    Record<
      | 'id'
      | 'tripId'
      | 'eventId'
      | 'position'
      | 'kind'
      | 'url'
      | 'key'
      | 'name'
      | 'startsOn'
      | 'endsOn'
      | 'arriveOn'
      | 'departOn'
      | 'costMinor'
      | 'costCurrency'
      | 'startsLocal'
      | 'startTz'
      | 'endsLocal'
      | 'endTz'
      | 'departsLocal'
      | 'departsTz'
      | 'arrivesLocal'
      | 'arrivesTz'
      | 'amountMinor'
      | 'currency'
      | 'spentOn'
      | 'fxRate'
      | 'fxSource'
      | 'fxRateDate'
      | 'shares'
      | 'doneAt'
      | 'doneBy'
      | 'origin'
      | 'titleKey'
      | 'templateItemKey'
      | 'baseCurrency',
      unknown
    >
  >

/** One column of a syncable table and how it appears on the wire. */
export interface ColumnSpec {
  /** Wire field (camelCase). */
  field: string
  /** Database column (snake_case). */
  column: string
  type: ColumnType
  /** Whether a client may set it through push. Derived and server-owned columns are not writable. */
  writable: boolean
  /** Writable on insert only: a client may not move a row to another parent. */
  immutable?: boolean
  /** The table a non-null value must point at, inside the same trip. */
  references?: string
}

/** A validation failure on the merged row, after the per-field schema passed. */
export interface FieldProblem {
  field: string
  rule: string
}

/** What the applier hands a derivation hook. */
export interface DeriveContext {
  trx: TransactionClientContract
  tripId: string
  tripRow: DbRow
  userId: string
  /** `now` as an ISO instant (from the clock, never `new Date()`). */
  now: string
  /** Whether the row is being created. */
  inserting: boolean
  /** The mutation's `changedAt` after clamping, epoch ms: the clock value of every field it sets. */
  changedAt: number
  /** Validated fields of `changes` that are not columns (an expense's `shares`), for the hooks. */
  extras: Record<string, unknown>
}

export interface DeriveResult {
  /** Extra column values to write (snake_case), computed from the merged row. */
  columns: DbRow
  problems: FieldProblem[]
}

export interface AfterWriteContext extends DeriveContext {
  /** The row as it is after the write (snake_case). */
  row: DbRow
  /** The row before the write, or null on insert. */
  previous: DbRow | null
  op: 'upsert' | 'delete'
}

/** What the applier hands a `prepare` hook, before the mutation's transaction opens. */
export interface PrepareContext {
  tripId: string
  /** The mutation's row id. */
  id: string
  /** The raw, not yet validated `changes`: a hook must treat them as untrusted hints. */
  changes: Record<string, unknown>
}

export interface EntitySpec {
  entity: SyncEntity
  table: string
  /** The column that holds the mutation's `id`: `id`, or `trip_id` for one-row-per-trip tables. */
  idColumn: string
  /** The column that names the trip. */
  tripColumn: string
  columns: ColumnSpec[]
  /** Validator of `changes` (every field optional). */
  validator: VineValidator<SchemaTypes, undefined>
  /** Fields a client must send when it creates the row. */
  requiredOnInsert: string[]
  /** Whether push may create a row (trips come from `POST /trips`, files from the upload route). */
  insertable: boolean
  /** Whether push may delete a row (the trip has its own route; emergency info is never deleted). */
  deletable: boolean
  /**
   * Computes derived columns from the merged row (`merged` has wire field
   * names) and reports problems with it that one field alone cannot show.
   */
  derive?: (merged: MergedRow, ctx: DeriveContext) => Promise<DeriveResult>
  /**
   * A live row of the trip that an insert with these validated `changes`
   * would duplicate (a checklist item the trip already has): the mutation
   * answers `duplicate` with that row and writes nothing, so a row made
   * offline reconciles with the one another device made first.
   */
  duplicateOf?: (changes: Record<string, unknown>, ctx: DeriveContext) => Promise<DbRow | null>
  /**
   * Slow lookups the write will need (an exchange rate from the provider),
   * run before the transaction so no lock is held across a network call.
   * Best effort: it never rejects the mutation, and the transaction reads
   * only what it left behind (the rate cache).
   */
  prepare?: (ctx: PrepareContext) => Promise<void>
  /** Side effects after the row is written (recompute a parent, print tasks, cascades). */
  afterWrite?: (ctx: AfterWriteContext) => Promise<void>
}

/** Wire field -> column spec, for lookups. */
export function columnsByField(spec: EntitySpec): Map<string, ColumnSpec> {
  return new Map(spec.columns.map((column) => [column.field, column]))
}
