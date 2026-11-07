import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { I18n } from '@adonisjs/i18n'
import { errors as vineErrors } from '@vinejs/vine'
import {
  SYNC_CHANGED_AT_WINDOW_DAYS,
  type SyncMutation,
  type SyncMutationResult,
  type SyncResultStatus,
} from '@monkitrips/shared'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { clampChangedAt, lwwMerge } from '#domain/lww_merge'
import { parseIsoInstant } from '#domain/iso_instant'
import { isUniqueViolation } from '#exceptions/unique_violation'
import { dataRejection } from '#services/sync/data_rejection'
import { PUSH_ENTITIES } from '#services/sync/entity_registry'
import {
  columnsByField,
  type ColumnSpec,
  type DbRow,
  type DeriveContext,
  type EntitySpec,
} from '#services/sync/entity_spec'
import { MutationRejected, problemMessage } from '#services/sync/mutation_rejected'
import { mergedWire, rowToWire, wireToColumns } from '#services/sync/row_wire'
import { liveRowInTrip } from '#services/sync/table_writes'

/**
 * The one write path of trip content (`POST /sync/push`), one mutation at a
 * time, each in its own transaction:
 *
 * 1. a replayed `mutationId` answers the stored result as `duplicate`
 *    (only applied and partial results are stored; a rejection is re-evaluated);
 * 2. the person must be a live member of a live trip, else `rejected`
 *    `E_ROW_NOT_FOUND` (never 403: the trip does not exist for them);
 * 3. `changes` pass the entity's validator, else `E_VALIDATION_ERROR`;
 * 4. a row id that lives in another trip answers `E_ROW_NOT_FOUND`, a
 *    tombstone answers `E_ROW_DELETED`, owner-only fields `E_TRIP_ROLE`;
 * 5. field-level last-write-wins decides what applies (`partial` when a
 *    field lost), derived values are recomputed and never taken from the
 *    client, side effects run, `trip_activity` records the field names.
 */
@inject()
export class MutationApplier {
  constructor(private readonly clock: Clock) {}

  async apply(user: User, mutation: SyncMutation, i18n: I18n): Promise<SyncMutationResult> {
    const now = this.clock.now()

    const replay = await this.replayOf(user, mutation, i18n)
    if (replay) return replay

    try {
      const changedAtDate = parseIsoInstant(mutation.changedAt)
      if (!changedAtDate) {
        throw MutationRejected.validation(i18n, [
          problemMessage(i18n, { field: 'changedAt', rule: 'instant' }),
        ])
      }
      const changedAt = clampChangedAt(
        changedAtDate.getTime(),
        now.getTime(),
        SYNC_CHANGED_AT_WINDOW_DAYS
      )
      return await db.transaction((trx) =>
        this.applyInTransaction(trx, user, mutation, i18n, now, changedAt)
      )
    } catch (error) {
      if (isUniqueViolation(error, 'sync_mutations_pkey')) {
        // The same mutation arrived twice at once: the loser answers like a replay.
        const stored = await this.replayOf(user, mutation, i18n)
        if (stored) return stored
      }
      // One bad mutation never fails the batch: its data answers a rejection, the rest go on.
      const rejection = error instanceof MutationRejected ? error : dataRejection(error, i18n)
      if (!rejection) throw error
      // Rejections are not stored: a retry is re-evaluated against the current state.
      return {
        mutationId: mutation.mutationId,
        status: 'rejected',
        error: rejection.error,
        ...(rejection.row ? { row: rejection.row as unknown as SyncMutationResult['row'] } : {}),
      }
    }
  }

  /** The stored result of an earlier delivery of this `mutationId`, marked `duplicate`. */
  private async replayOf(
    user: User,
    mutation: SyncMutation,
    i18n: I18n
  ): Promise<SyncMutationResult | null> {
    const stored = (await db.from('sync_mutations').where('id', mutation.mutationId).first()) as {
      user_id: string
      response: SyncMutationResult
    } | null
    if (!stored) return null
    if (stored.user_id !== user.id) {
      return {
        mutationId: mutation.mutationId,
        status: 'rejected',
        error: { code: 'E_CONFLICT', message: i18n.t('errors.E_CONFLICT', {}, 'E_CONFLICT') },
      }
    }
    return { ...stored.response, mutationId: mutation.mutationId, status: 'duplicate' }
  }

  private async applyInTransaction(
    trx: TransactionClientContract,
    user: User,
    mutation: SyncMutation,
    i18n: I18n,
    now: Date,
    changedAt: number
  ): Promise<SyncMutationResult> {
    const membership = (await trx
      .from('trip_members')
      .where('trip_id', mutation.tripId)
      .where('user_id', user.id)
      .whereNull('deleted_at')
      .first()) as { role: string } | null
    const tripRow = (await trx
      .from('trips')
      .where('id', mutation.tripId)
      .whereNull('deleted_at')
      .forUpdate()
      .first()) as DbRow | null
    if (!membership || !tripRow) throw MutationRejected.code(i18n, 'E_ROW_NOT_FOUND')

    const spec = PUSH_ENTITIES[mutation.entity]
    if (spec.idColumn === 'trip_id' || spec.tripColumn === 'id') {
      if (mutation.id !== mutation.tripId) throw MutationRejected.code(i18n, 'E_ROW_NOT_FOUND')
    }

    const changes = await this.validate(spec, mutation.changes ?? {}, i18n)
    const current =
      spec.table === 'trips'
        ? tripRow
        : ((await trx
            .from(spec.table)
            .where(spec.idColumn, mutation.id)
            .forUpdate()
            .first()) as DbRow | null)
    if (current && String(current[spec.tripColumn]) !== mutation.tripId) {
      throw MutationRejected.code(i18n, 'E_ROW_NOT_FOUND')
    }

    const ctx: DeriveContext = {
      trx,
      tripId: mutation.tripId,
      tripRow,
      userId: user.id,
      now: now.toISOString(),
      inserting: current === null,
      changedAt,
      extras: {},
    }

    if (mutation.op === 'delete') {
      return this.applyDelete(spec, mutation, current, ctx, i18n)
    }
    return this.applyUpsert(spec, mutation, changes, current, membership.role, ctx, i18n)
  }

  private async validate(
    spec: EntitySpec,
    changes: Record<string, unknown>,
    i18n: I18n
  ): Promise<Record<string, unknown>> {
    try {
      return (await spec.validator.validate(changes, {
        meta: undefined,
        messagesProvider: i18n.createMessagesProvider(),
      })) as Record<string, unknown>
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        throw MutationRejected.validation(i18n, error.messages)
      }
      throw error
    }
  }

  private async applyDelete(
    spec: EntitySpec,
    mutation: SyncMutation,
    current: DbRow | null,
    ctx: DeriveContext,
    i18n: I18n
  ): Promise<SyncMutationResult> {
    if (!current) throw MutationRejected.code(i18n, 'E_ROW_NOT_FOUND')
    if (!spec.deletable)
      throw MutationRejected.code(i18n, 'E_BAD_REQUEST', rowToWire(spec, current))
    if (current.deleted_at) {
      return this.finish(spec, mutation, current, 'applied', [], ctx, 'noop')
    }
    if (spec.entity === 'traveller' && current.user_id) {
      // A traveller behind an account leaves through the members routes.
      throw MutationRejected.code(i18n, 'E_BAD_REQUEST', rowToWire(spec, current))
    }
    await ctx.trx
      .from(spec.table)
      .where(spec.idColumn, mutation.id)
      .update({
        deleted_at: new Date(ctx.now),
        updated_by: ctx.userId,
        field_clock: ctx.trx.raw('field_clock || ?::jsonb', [
          JSON.stringify({ deletedAt: ctx.changedAt }),
        ]),
      })
    const fresh = (await this.reload(spec, mutation.id, ctx)) as DbRow
    await spec.afterWrite?.({ ...ctx, row: fresh, previous: current, op: 'delete' })
    return this.finish(spec, mutation, fresh, 'applied', [], ctx, 'deleted')
  }

  private async applyUpsert(
    spec: EntitySpec,
    mutation: SyncMutation,
    changes: Record<string, unknown>,
    current: DbRow | null,
    role: string,
    ctx: DeriveContext,
    i18n: I18n
  ): Promise<SyncMutationResult> {
    const columns = columnsByField(spec)
    if (current?.deleted_at) {
      throw MutationRejected.code(i18n, 'E_ROW_DELETED', rowToWire(spec, current))
    }
    if (!current && !spec.insertable) throw MutationRejected.code(i18n, 'E_ROW_NOT_FOUND')

    // Fields that are not columns (an expense's `shares`) go to the hooks.
    const writable: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(changes)) {
      const column = columns.get(field)
      if (column?.writable) writable[field] = value
      else if (!column) ctx.extras[field] = value
    }

    const problems: { field: string; rule: string }[] = []
    if (!current) {
      for (const field of spec.requiredOnInsert) {
        if (writable[field] === undefined || writable[field] === null) {
          problems.push({ field, rule: 'required' })
        }
      }
    } else {
      for (const [field, value] of Object.entries(writable)) {
        const column = columns.get(field)!
        if (column.immutable && value !== rowToWire(spec, current)[field]) {
          problems.push({ field, rule: 'immutable' })
        }
      }
    }
    if (problems.length > 0) {
      throw MutationRejected.validation(
        i18n,
        problems.map((problem) => problemMessage(i18n, problem)),
        current ? rowToWire(spec, current) : null
      )
    }

    if (spec.entity === 'trip' && current) {
      await this.checkTripRoleRules(writable, current, role, ctx, i18n)
    }

    const merge = lwwMerge({
      current: current ? rowToWire(spec, current) : null,
      deleted: false,
      clock: (current?.field_clock as Record<string, number> | undefined) ?? {},
      changes: writable,
      changedAt: ctx.changedAt,
    })
    if (merge.outcome === 'deleted') {
      throw MutationRejected.code(i18n, 'E_ROW_DELETED', rowToWire(spec, current!))
    }

    await this.checkReferences(spec, mutation.id, merge.applied, ctx, i18n)

    const merged = {
      ...mergedWire(spec, current, merge.applied),
      id: mutation.id,
      tripId: mutation.tripId,
      ...ctx.extras,
    }
    const derived = spec.derive ? await spec.derive(merged, ctx) : { columns: {}, problems: [] }
    if (derived.problems.length > 0) {
      throw MutationRejected.validation(
        i18n,
        derived.problems.map((problem) => problemMessage(i18n, problem)),
        current ? rowToWire(spec, current) : null
      )
    }

    const values = this.columnValues(columns, current, merge.applied, derived.columns)
    const hasExtras = Object.keys(ctx.extras).length > 0
    if (!current) {
      await ctx.trx.table(spec.table).insert({
        [spec.idColumn]: mutation.id,
        [spec.tripColumn]: mutation.tripId,
        ...values,
        field_clock: JSON.stringify(merge.clock),
        updated_by: ctx.userId,
      })
    } else if (Object.keys(values).length > 0 || hasExtras) {
      await ctx.trx
        .from(spec.table)
        .where(spec.idColumn, mutation.id)
        .update({ ...values, field_clock: JSON.stringify(merge.clock), updated_by: ctx.userId })
    }

    let fresh = (await this.reload(spec, mutation.id, ctx)) as DbRow
    if (spec.afterWrite) {
      await spec.afterWrite({ ...ctx, row: fresh, previous: current, op: 'upsert' })
      fresh = (await this.reload(spec, mutation.id, ctx)) as DbRow
    }

    const status: SyncResultStatus = merge.rejectedFields.length > 0 ? 'partial' : 'applied'
    const appliedFields = [...Object.keys(merge.applied), ...Object.keys(ctx.extras)]
    return this.finish(
      spec,
      mutation,
      fresh,
      status,
      merge.rejectedFields,
      ctx,
      current ? 'updated' : 'created',
      appliedFields
    )
  }

  /** `baseCurrency` is the owner's call, and only while the trip has no expenses. */
  private async checkTripRoleRules(
    writable: Record<string, unknown>,
    current: DbRow,
    role: string,
    ctx: DeriveContext,
    i18n: I18n
  ): Promise<void> {
    if (
      writable['baseCurrency'] === undefined ||
      writable['baseCurrency'] === current.base_currency
    ) {
      return
    }
    if (role !== 'owner') throw MutationRejected.code(i18n, 'E_TRIP_ROLE')
    const expense = await ctx.trx
      .from('expenses')
      .where('trip_id', ctx.tripId)
      .whereNull('deleted_at')
      .select('id')
      .first()
    if (expense) throw MutationRejected.code(i18n, 'E_BASE_CURRENCY_LOCKED')
  }

  /**
   * Every id a mutation points at must be a live row of the same trip, else
   * the row "does not exist". The ids of an expense's `shares` are rows the
   * mutation writes: each must be new or already a share of this expense
   * (`rowId`), never a row of another expense or another trip.
   */
  private async checkReferences(
    spec: EntitySpec,
    rowId: string,
    applied: Record<string, unknown>,
    ctx: DeriveContext,
    i18n: I18n
  ): Promise<void> {
    for (const column of spec.columns) {
      if (!column.references) continue
      const value = applied[column.field]
      if (value === undefined || value === null) continue
      const row = await liveRowInTrip(ctx.trx, column.references, String(value), ctx.tripId)
      if (!row) throw MutationRejected.code(i18n, 'E_ROW_NOT_FOUND')
    }
    const shares = ctx.extras['shares'] as { id: string; travellerId: string }[] | undefined
    for (const share of shares ?? []) {
      const row = await liveRowInTrip(ctx.trx, 'travellers', share.travellerId, ctx.tripId)
      if (!row) throw MutationRejected.code(i18n, 'E_ROW_NOT_FOUND')
      // A share id is a client id too: it may only name a share of this very expense.
      const existing = (await ctx.trx
        .from('expense_shares')
        .where('id', share.id)
        .forUpdate()
        .select('trip_id', 'expense_id')
        .first()) as DbRow | null
      if (
        existing &&
        (String(existing.trip_id) !== ctx.tripId || String(existing.expense_id) !== rowId)
      ) {
        throw MutationRejected.code(i18n, 'E_ROW_NOT_FOUND')
      }
    }
  }

  /** The columns to write: the applied fields plus the derived ones; virtual `content.<key>` fields fold into `content`. */
  private columnValues(
    columns: Map<string, ColumnSpec>,
    current: DbRow | null,
    applied: Record<string, unknown>,
    derived: DbRow
  ): DbRow {
    const plain: Record<string, unknown> = {}
    const virtual: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(applied)) {
      const column = columns.get(field)
      if (!column) continue
      if (column.column.startsWith('content.')) virtual[field] = value
      else plain[field] = value
    }
    const values = { ...wireToColumns(columns, plain), ...derived }
    if (Object.keys(virtual).length > 0) {
      const content = { ...((current?.content as Record<string, unknown>) ?? {}), ...virtual }
      values.content = JSON.stringify(content)
    }
    return values
  }

  private async reload(spec: EntitySpec, id: string, ctx: DeriveContext): Promise<DbRow | null> {
    return ((await ctx.trx.from(spec.table).where(spec.idColumn, id).first()) as DbRow) ?? null
  }

  /** Records the activity, stores the result for replays and shapes the answer. */
  private async finish(
    spec: EntitySpec,
    mutation: SyncMutation,
    row: DbRow,
    status: SyncResultStatus,
    rejectedFields: string[],
    ctx: DeriveContext,
    action: 'created' | 'updated' | 'deleted' | 'noop',
    fields: string[] = []
  ): Promise<SyncMutationResult> {
    if (action !== 'noop' && !(action === 'updated' && fields.length === 0)) {
      await ctx.trx.table('trip_activity').insert({
        trip_id: mutation.tripId,
        actor_user_id: ctx.userId,
        entity: spec.entity,
        entity_id: mutation.id,
        action,
        fields,
      })
    }
    const result: SyncMutationResult = {
      mutationId: mutation.mutationId,
      status,
      ...(rejectedFields.length > 0 ? { rejectedFields } : {}),
      row: rowToWire(spec, row) as unknown as SyncMutationResult['row'],
    }
    await ctx.trx.table('sync_mutations').insert({
      id: mutation.mutationId,
      user_id: ctx.userId,
      trip_id: mutation.tripId,
      status,
      response: JSON.stringify(result),
    })
    return result
  }
}
