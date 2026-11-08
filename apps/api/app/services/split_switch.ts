import { randomUUID } from 'node:crypto'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { equalShares } from '@monkitrips/shared'
import type { AfterWriteContext } from '#services/sync/entity_spec'
import { liveTravellerIds } from '#services/live_travellers'
import { ownerTravellerId } from '#services/owner_traveller'

/** Who writes and when: the mutation's account and its `changedAt` (epoch ms). */
export interface SplitWriter {
  trx: TransactionClientContract
  tripId: string
  userId: string
  changedAt: number
}

/** What `completeSplits` wrote on one expense, as wire field names. */
export interface CompletedSplit {
  expenseId: string
  fields: string[]
}

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
 * Makes live expenses of a split trip complete: one without a payer gets
 * the owner's traveller, one without a live split gets equal shares among
 * every live traveller (the remainder on the payer). Payers and splits
 * already recorded are kept. `expenseIds` narrows it to those expenses;
 * null means every live expense of the trip. Each expense it touches gets
 * the field clocks of what it wrote, at `changedAt`. Answers what it wrote.
 */
export async function completeSplits(
  writer: SplitWriter,
  expenseIds: readonly string[] | null
): Promise<CompletedSplit[]> {
  const { trx, tripId } = writer
  const travellerIds = await liveTravellerIds(trx, tripId)
  if (travellerIds.length === 0) return []
  const fallbackPayer = (await ownerTravellerId(trx, tripId)) ?? travellerIds[0]

  const query = trx
    .from('expenses')
    .where('trip_id', tripId)
    .whereNull('deleted_at')
    .orderBy('spent_on')
    .orderBy('id')
    .forUpdate()
    .select('id', 'amount_minor', 'paid_by_traveller_id')
  if (expenseIds) query.whereIn('id', [...expenseIds])
  const expenses = (await query) as {
    id: string
    amount_minor: string
    paid_by_traveller_id: string | null
  }[]
  if (expenses.length === 0) return []
  const withShares = new Set(
    (
      (await trx
        .from('expense_shares')
        .where('trip_id', tripId)
        .whereIn(
          'expense_id',
          expenses.map((expense) => expense.id)
        )
        .whereNull('deleted_at')
        .distinct('expense_id')) as { expense_id: string }[]
    ).map((row) => row.expense_id)
  )

  const shareClock = JSON.stringify({
    shareMinor: writer.changedAt,
    travellerId: writer.changedAt,
  })
  const completed: CompletedSplit[] = []
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
        await trx.table('expense_shares').insert({
          id: randomUUID(),
          expense_id: expense.id,
          trip_id: tripId,
          traveller_id: share.travellerId,
          share_minor: share.shareMinor,
          updated_by: writer.userId,
          field_clock: shareClock,
        })
      }
    }
    if (fields.length === 0) continue
    const clock = Object.fromEntries(fields.map((field) => [field, writer.changedAt]))
    await trx
      .from('expenses')
      .where('id', expense.id)
      .update({
        ...values,
        updated_by: writer.userId,
        field_clock: trx.raw('field_clock || ?::jsonb', [JSON.stringify(clock)]),
      })
    completed.push({ expenseId: expense.id, fields })
  }
  return completed
}

/**
 * A trip that just switched to split: every live expense is completed
 * (`completeSplits`) inside the trip mutation's own transaction, each one
 * it touched with its own `trip_activity` row. Switching back to shared
 * writes nothing: the data stays and the client hides it.
 */
export async function assignSplit(ctx: AfterWriteContext): Promise<void> {
  const completed = await completeSplits(ctx, null)
  for (const { expenseId, fields } of completed) {
    await ctx.trx.table('trip_activity').insert({
      trip_id: ctx.tripId,
      actor_user_id: ctx.userId,
      entity: 'expense',
      entity_id: expenseId,
      action: 'updated',
      fields,
    })
  }
}
