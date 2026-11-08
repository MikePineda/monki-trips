import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { equalShares, minorUnitExponent } from '@monkitrips/shared'
import type { DbRow, DeriveContext, EntitySpec, FieldProblem } from '#services/sync/entity_spec'
import { convertToBaseMinor } from '#domain/convert_to_base'
import { FxRates } from '#services/fx/fx_rates'
import { liveTravellerIds } from '#services/live_travellers'
import { toWireValue } from '#services/sync/column_types'
import { tombstoneWhere } from '#services/sync/table_writes'
import { expenseChanges } from '#validators/sync/entities'

const CURRENCY = /^[A-Za-z]{3}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A raw `changes` value that looks like `pattern`, normalised, or null. */
function hint(
  value: unknown,
  pattern: RegExp,
  normalise: (value: string) => string = (v) => v
): string | null {
  if (typeof value !== 'string' || !pattern.test(value.trim())) return null
  return normalise(value.trim())
}

/** The largest minor amount the wire carries exactly (the validators cap inputs the same way). */
const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER)

/**
 * The split of an expense whose amount moved without a new split: the
 * same live participants, equally, the remainder on the payer, with fresh
 * share ids (a device that never saw the split, or a stale one, only knew
 * the amount). Null when the amount did not change or there is no split.
 * A participant no longer travelling drops out; with nobody left, every
 * live traveller shares it.
 */
async function resplit(
  ctx: DeriveContext,
  expenseId: string,
  amount: number,
  payer: string | null
): Promise<ShareInput[] | null> {
  const [stored] = (await ctx.trx
    .from('expenses')
    .where('id', expenseId)
    .select('amount_minor')) as { amount_minor: string }[]
  if (BigInt(stored.amount_minor) === BigInt(amount)) return null
  const shares = (await ctx.trx
    .from('expense_shares')
    .where('expense_id', expenseId)
    .whereNull('deleted_at')
    .select('traveller_id')) as { traveller_id: string }[]
  if (shares.length === 0) return null
  const live = await liveTravellerIds(ctx.trx, ctx.tripId)
  const sharing = live.filter((id) => shares.some((share) => share.traveller_id === id))
  return equalShares(amount, sharing.length > 0 ? sharing : live, payer).map((share) => ({
    id: randomUUID(),
    ...share,
  }))
}

interface ShareInput {
  id: string
  travellerId: string
  shareMinor: number
}

/**
 * Expenses in the currency paid. The client may fix a rate (`fxRate`,
 * typed by hand or fixed at booking); otherwise the server looks the rate
 * of `spentOn` up, from the cache or the provider, and leaves the expense
 * waiting (`baseAmountMinor` null) when nobody can tell. The provider is
 * asked in `prepare`, before the transaction locks the trip row; inside
 * it, `derive` reads the cache only. `baseAmountMinor`
 * is always derived here. An optional `shares` array replaces the whole
 * split atomically and must sum to the amount; a new amount without one
 * splits the stored split again equally (`resplit`).
 */
export const expenseEntity: EntitySpec = {
  entity: 'expense',
  table: 'expenses',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: expenseChanges,
  requiredOnInsert: ['amountMinor', 'currency', 'spentOn'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    // Set on insert only: a settlement never turns into spending or back.
    { field: 'kind', column: 'kind', type: 'text', writable: true, immutable: true },
    {
      field: 'categoryId',
      column: 'category_id',
      type: 'text',
      writable: true,
      references: 'budget_categories',
    },
    { field: 'eventId', column: 'event_id', type: 'text', writable: true, references: 'events' },
    { field: 'amountMinor', column: 'amount_minor', type: 'int', writable: true },
    { field: 'currency', column: 'currency', type: 'text', writable: true },
    { field: 'fxRate', column: 'fx_rate', type: 'decimalString', writable: true },
    { field: 'fxRateDate', column: 'fx_rate_date', type: 'date', writable: true },
    { field: 'fxSource', column: 'fx_source', type: 'text', writable: true },
    { field: 'baseAmountMinor', column: 'base_amount_minor', type: 'int', writable: false },
    { field: 'spentOn', column: 'spent_on', type: 'date', writable: true },
    { field: 'description', column: 'description', type: 'text', writable: true },
    {
      field: 'paidByTravellerId',
      column: 'paid_by_traveller_id',
      type: 'text',
      writable: true,
      references: 'travellers',
    },
    { field: 'needsDetails', column: 'needs_details', type: 'bool', writable: true },
    { field: 'createdBy', column: 'created_by', type: 'text', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async prepare({ tripId, id, changes }) {
    const trip = (await db
      .from('trips')
      .where('id', tripId)
      .whereNull('deleted_at')
      .select('base_currency')
      .first()) as DbRow | null
    if (!trip) return
    const stored = (await db
      .from('expenses')
      .where('id', id)
      .where('trip_id', tripId)
      .select('currency', 'spent_on', 'fx_rate')
      .first()) as DbRow | null
    const currency = hint(changes['currency'], CURRENCY, (value) => value.toUpperCase())
    const spentOn = hint(changes['spentOn'], ISO_DATE)
    const rate = 'fxRate' in changes ? changes['fxRate'] : stored?.fx_rate
    const quote = currency ?? (stored ? String(stored.currency) : null)
    const day = spentOn ?? (stored ? toWireValue('date', stored.spent_on) : null)
    const base = String(trip.base_currency)
    if (!quote || typeof day !== 'string' || quote === base || rate) return
    const fxRates = await app.container.make(FxRates)
    await fxRates.find(base, quote, day)
  },
  async derive(merged, ctx) {
    const problems: FieldProblem[] = []
    const columns: DbRow = {}
    const amount = Number(merged.amountMinor)
    if (amount === 0) problems.push({ field: 'amountMinor', rule: 'notZero' })
    if (ctx.inserting) columns.created_by = ctx.userId

    const shares = merged.shares as ShareInput[] | undefined
    if (shares) {
      // BigInt: fifty safe integers can add up past the safe range.
      const sum = shares.reduce((total, share) => total + BigInt(share.shareMinor), 0n)
      if (sum !== BigInt(amount)) problems.push({ field: 'shares', rule: 'sharesSum' })
      const travellers = new Set(shares.map((share) => share.travellerId))
      if (travellers.size !== shares.length) problems.push({ field: 'shares', rule: 'distinct' })
    } else if (!ctx.inserting) {
      // The amount moved without a new split: split it again so the shares still add up.
      const payer = (merged.paidByTravellerId as string | null | undefined) ?? null
      const again = await resplit(ctx, String(merged.id), amount, payer)
      if (again) ctx.extras['shares'] = again
    }
    if (problems.length > 0) return { columns, problems }

    const base = String(ctx.tripRow.base_currency)
    const currency = String(merged.currency)
    const spentOn = String(merged.spentOn)
    let rate = (merged.fxRate as string | null | undefined) ?? null
    let source = (merged.fxSource as string | null | undefined) ?? null
    let rateDate = (merged.fxRateDate as string | null | undefined) ?? null
    if (currency === base) {
      rate = '1'
      source = 'identity'
      rateDate = spentOn
    } else if (rate) {
      source ??= 'manual'
      rateDate ??= spentOn
    } else {
      // Cache only: `prepare` asked the provider before the trip row was locked.
      const fxRates = await app.container.make(FxRates)
      const known = await fxRates.findCached(base, currency, spentOn, ctx.trx)
      if (known) {
        rate = known.rate
        source = known.source
        rateDate = spentOn
      } else {
        source = null
        rateDate = null
      }
    }
    columns.fx_rate = rate
    columns.fx_source = source
    columns.fx_rate_date = rateDate
    const baseAmount = rate
      ? convertToBaseMinor({
          amountMinor: amount,
          rate,
          fromExponent: minorUnitExponent(currency).exponent,
          toExponent: minorUnitExponent(base).exponent,
        })
      : null
    if (baseAmount !== null && (baseAmount > MAX_MINOR || baseAmount < -MAX_MINOR)) {
      problems.push({ field: 'amountMinor', rule: 'convertedRange' })
    }
    columns.base_amount_minor = baseAmount === null ? null : Number(baseAmount)
    return { columns, problems }
  },
  async afterWrite(ctx) {
    const by = {
      userId: ctx.userId,
      now: ctx.now,
      changedAt: ctx.changedAt,
    }
    if (ctx.op === 'delete') {
      await tombstoneWhere(ctx.trx, 'expense_shares', 'expense_id', String(ctx.row.id), by)
      return
    }
    const shares = ctx.extras['shares'] as ShareInput[] | undefined
    if (!shares) return
    // Replace the whole split: tombstone what is live, then write the new shares.
    // The applier already refused share ids of another expense or trip; the
    // update is still fenced to this expense, and an insert of an id that
    // lives elsewhere fails on the primary key instead of taking the row over.
    const expenseId = String(ctx.row.id)
    await tombstoneWhere(ctx.trx, 'expense_shares', 'expense_id', expenseId, by)
    // A split written here (sent, or split again after an amount change) owns the `shares` clock.
    await ctx.trx
      .from('expenses')
      .where('id', expenseId)
      .update({
        field_clock: ctx.trx.raw(
          `field_clock || jsonb_build_object('shares', greatest(coalesce((field_clock->>'shares')::bigint, 0), ?::bigint))`,
          [by.changedAt]
        ),
      })
    const clock = JSON.stringify({ shareMinor: by.changedAt, travellerId: by.changedAt })
    for (const share of shares) {
      const updated = await ctx.trx
        .from('expense_shares')
        .where('id', share.id)
        .where('trip_id', ctx.tripId)
        .where('expense_id', expenseId)
        .update({
          traveller_id: share.travellerId,
          share_minor: share.shareMinor,
          deleted_at: null,
          updated_by: by.userId,
          field_clock: clock,
        })
      if (Number(updated) > 0) continue
      await ctx.trx.table('expense_shares').insert({
        id: share.id,
        expense_id: expenseId,
        trip_id: ctx.tripId,
        traveller_id: share.travellerId,
        share_minor: share.shareMinor,
        updated_by: by.userId,
        field_clock: clock,
      })
    }
  },
}
