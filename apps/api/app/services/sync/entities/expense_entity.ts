import app from '@adonisjs/core/services/app'
import { minorUnitExponent } from '@monkitrips/shared'
import type { DbRow, EntitySpec, FieldProblem } from '#services/sync/entity_spec'
import { convertToBaseMinor } from '#domain/convert_to_base'
import { FxRates } from '#services/fx/fx_rates'
import { tombstoneWhere } from '#services/sync/table_writes'
import { expenseChanges } from '#validators/sync/entities'

/** The largest minor amount the wire carries exactly (the validators cap inputs the same way). */
const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER)

interface ShareInput {
  id: string
  travellerId: string
  shareMinor: number
}

/**
 * Expenses in the currency paid. The client may fix a rate (`fxRate`,
 * typed by hand or fixed at booking); otherwise the server looks the rate
 * of `spentOn` up, from the cache or the provider, and leaves the expense
 * waiting (`baseAmountMinor` null) when nobody can tell. `baseAmountMinor`
 * is always derived here. An optional `shares` array replaces the whole
 * split atomically and must sum to the amount.
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
      const fxRates = await app.container.make(FxRates)
      const known = await fxRates.find(base, currency, spentOn, ctx.trx)
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
