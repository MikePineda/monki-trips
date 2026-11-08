import { randomUUID } from 'node:crypto'
import { equalShares } from '@monkitrips/shared'
import type { AfterWriteContext } from '#services/sync/entity_spec'
import { ownerTravellerId } from '#services/owner_traveller'

/** Whether this write of the trip row turned it from shared into split. */
export function switchedToSplit(ctx: AfterWriteContext): boolean {
  return (
    ctx.op === 'upsert' &&
    ctx.previous !== null &&
    ctx.previous['budget_mode'] !== 'split' &&
    ctx.row['budget_mode'] === 'split'
  )
}

/**
 * Makes every live expense of a trip that just switched to split complete,
 * inside the trip mutation's own transaction: an expense without a payer
 * gets the owner's traveller, one without a live split gets equal shares
 * among every live traveller (the remainder on the payer). Payers and
 * splits already recorded (a trip switched back and forth) are kept. Each
 * expense it touches gets the field clocks of what it wrote, at the
 * mutation's `changedAt`, and its own `trip_activity` row. Switching back
 * to shared writes nothing: the data stays and the client hides it.
 */
export async function assignSplit(ctx: AfterWriteContext): Promise<void> {
  const travellers = (await ctx.trx
    .from('travellers')
    .where('trip_id', ctx.tripId)
    .whereNull('deleted_at')
    .orderBy('position')
    .orderBy('created_at')
    .select('id')) as { id: string }[]
  if (travellers.length === 0) return
  const travellerIds = travellers.map((traveller) => traveller.id)
  const fallbackPayer = (await ownerTravellerId(ctx.trx, ctx.tripId)) ?? travellerIds[0]

  const expenses = (await ctx.trx
    .from('expenses')
    .where('trip_id', ctx.tripId)
    .whereNull('deleted_at')
    .orderBy('spent_on')
    .orderBy('id')
    .forUpdate()
    .select('id', 'amount_minor', 'paid_by_traveller_id')) as {
    id: string
    amount_minor: string
    paid_by_traveller_id: string | null
  }[]
  const withShares = new Set(
    (
      (await ctx.trx
        .from('expense_shares')
        .where('trip_id', ctx.tripId)
        .whereNull('deleted_at')
        .distinct('expense_id')) as { expense_id: string }[]
    ).map((row) => row.expense_id)
  )

  const shareClock = JSON.stringify({ shareMinor: ctx.changedAt, travellerId: ctx.changedAt })
  for (const expense of expenses) {
    const fields: string[] = []
    const values: Record<string, unknown> = {}
    const payer = expense.paid_by_traveller_id ?? fallbackPayer
    if (expense.paid_by_traveller_id === null) {
      fields.push('paidByTravellerId')
      values['paid_by_traveller_id'] = payer
    }
    if (!withShares.has(expense.id)) {
      fields.push('shares')
      for (const share of equalShares(expense.amount_minor, travellerIds, payer)) {
        await ctx.trx.table('expense_shares').insert({
          id: randomUUID(),
          expense_id: expense.id,
          trip_id: ctx.tripId,
          traveller_id: share.travellerId,
          share_minor: share.shareMinor,
          updated_by: ctx.userId,
          field_clock: shareClock,
        })
      }
    }
    if (fields.length === 0) continue
    const clock = Object.fromEntries(fields.map((field) => [field, ctx.changedAt]))
    await ctx.trx
      .from('expenses')
      .where('id', expense.id)
      .update({
        ...values,
        updated_by: ctx.userId,
        field_clock: ctx.trx.raw('field_clock || ?::jsonb', [JSON.stringify(clock)]),
      })
    await ctx.trx.table('trip_activity').insert({
      trip_id: ctx.tripId,
      actor_user_id: ctx.userId,
      entity: 'expense',
      entity_id: expense.id,
      action: 'updated',
      fields,
    })
  }
}
