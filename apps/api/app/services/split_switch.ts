import { randomUUID } from 'node:crypto'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { equalShares } from '@monkitrips/shared'
import type { AfterWriteContext } from '#services/sync/entity_spec'
import { liveTravellerIds } from '#services/live_travellers'
import { ownerTravellerId } from '#services/owner_traveller'

/** Rows per bulk statement, well under Postgres' 65 535 bound parameters. */
const BATCH = 1000

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
 * already recorded are kept, and so is a field whose clock is newer than
 * `changedAt` (an older switch arriving late never undoes a later edit).
 * `expenseIds` narrows it to those expenses; null means every live
 * expense of the trip. A field it writes keeps the greater of its stored
 * clock and `changedAt`. Answers what it wrote.
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
    .select('id', 'amount_minor', 'paid_by_traveller_id', 'field_clock')
  if (expenseIds) query.whereIn('id', [...expenseIds])
  const expenses = (await query) as {
    id: string
    amount_minor: string
    paid_by_traveller_id: string | null
    field_clock: Record<string, number> | null
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
  const shareRows: Record<string, unknown>[] = []
  const updates: { id: string; payer: string | null; clock: string }[] = []
  for (const expense of expenses) {
    const fields: string[] = []
    const stored = expense.field_clock ?? {}
    const writable = (field: string) => (stored[field] ?? 0) <= writer.changedAt
    const payer = expense.paid_by_traveller_id ?? fallbackPayer
    let newPayer: string | null = null
    if (expense.paid_by_traveller_id === null && writable('paidByTravellerId')) {
      fields.push('paidByTravellerId')
      newPayer = payer
    }
    if (!withShares.has(expense.id) && writable('shares')) {
      fields.push('shares')
      for (const share of equalShares(expense.amount_minor, travellerIds, payer)) {
        shareRows.push({
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
    const clock = Object.fromEntries(
      fields.map((field) => [field, Math.max(stored[field] ?? 0, writer.changedAt)])
    )
    updates.push({ id: expense.id, payer: newPayer, clock: JSON.stringify(clock) })
    completed.push({ expenseId: expense.id, fields })
  }

  for (let start = 0; start < shareRows.length; start += BATCH) {
    await trx.table('expense_shares').multiInsert(shareRows.slice(start, start + BATCH))
  }
  for (let start = 0; start < updates.length; start += BATCH) {
    const batch = updates.slice(start, start + BATCH)
    // One statement per batch: the payer only where it was missing, the clocks merged.
    await trx.rawQuery(
      `UPDATE expenses AS e
          SET paid_by_traveller_id = coalesce(v.payer, e.paid_by_traveller_id),
              updated_by = ?,
              field_clock = e.field_clock || v.clock
         FROM (VALUES ${batch.map(() => "(?::uuid, nullif(?, '')::uuid, ?::jsonb)").join(', ')})
           AS v(id, payer, clock)
        WHERE e.id = v.id`,
      [writer.userId, ...batch.flatMap((update) => [update.id, update.payer ?? '', update.clock])]
    )
  }
  return completed
}

/**
 * A trip that just switched to split: every live expense is completed
 * (`completeSplits`) inside the trip mutation's own transaction, each one
 * it touched with its own `trip_activity` row, all of them written in a
 * few bulk statements whatever the number of expenses. Switching back to shared
 * writes nothing: the data stays and the client hides it.
 */
export async function assignSplit(ctx: AfterWriteContext): Promise<void> {
  const completed = await completeSplits(ctx, null)
  if (completed.length === 0) return
  // One activity row per expense (the feed names the row that changed), written in bulk.
  for (let start = 0; start < completed.length; start += BATCH) {
    await ctx.trx.table('trip_activity').multiInsert(
      completed.slice(start, start + BATCH).map(({ expenseId, fields }) => ({
        trip_id: ctx.tripId,
        actor_user_id: ctx.userId,
        entity: 'expense',
        entity_id: expenseId,
        action: 'updated',
        fields,
      }))
    )
  }
}
