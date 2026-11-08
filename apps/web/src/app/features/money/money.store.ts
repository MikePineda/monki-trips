import { Injectable, inject } from '@angular/core'
import { convertToBase, scaleShares } from '@monkitrips/shared'
import { v7 as uuidv7 } from 'uuid'
import { CLOCK } from '../../core/offline/clock'
import type { MonkiTripsDb } from '../../core/offline/db'
import type { OutboxMutation } from '../../core/offline/mutation'
import { OFFLINE_DB } from '../../core/offline/offline-db'
import { OutboxStore } from '../../core/offline/outbox.store'
import type { ExpenseRecord, ExpenseShareRecord } from '../../core/offline/records'
import { SyncService } from '../../core/offline/sync.service'
import { TripContentStore } from '../../core/offline/trip-content.store'

export interface QuickExpenseInput {
  tripId: string
  baseCurrency: string
  amountMinor: number
  currency: string
  categoryId: string | null
  /** YYYY-MM-DD in the place's zone. */
  spentOn: string
  /** The person's own traveller, when the device knows it (shared mode never shows it). */
  paidByTravellerId: string | null
  /** Split mode: who shares the expense, adding up to `amountMinor`. */
  shares?: readonly SplitShare[] | null
}

/** One traveller's part of an expense, in the expense's currency. */
export interface SplitShare {
  travellerId: string
  shareMinor: number
}

/** Who paid an expense and who shares it; the shares add up to its amount. */
export interface SplitChoice {
  paidByTravellerId: string
  shares: readonly SplitShare[]
}

/** A deleted expense with its split, what undo needs to bring both back. */
export type RemovedExpense = ExpenseRecord & { removedShares?: readonly SplitShare[] }

/** A transfer between two travellers recorded as an expense (`settle`). */
export interface SettlementInput {
  tripId: string
  baseCurrency: string
  fromTravellerId: string
  toTravellerId: string
  /** In base minor units, positive. */
  amountMinor: number
  /** The trip's `other` category. */
  categoryId: string | null
  spentOn: string
  /** "Settle up", in the person's language. */
  description: string
}

/** What the edit sheet may change; `fxRate` set means "use this rate" (manual), null means "look it up". */
export type ExpenseChanges = Partial<
  Pick<
    ExpenseRecord,
    'amountMinor' | 'currency' | 'fxRate' | 'spentOn' | 'description' | 'categoryId' | 'eventId'
  >
>

/** Fields of an expense the API writes; the rest (`baseAmountMinor`, `createdBy`) is derived. */
const WRITABLE = [
  'kind',
  'categoryId',
  'eventId',
  'amountMinor',
  'currency',
  'fxRate',
  'fxRateDate',
  'fxSource',
  'spentOn',
  'description',
  'paidByTravellerId',
  'needsDetails',
] as const

/**
 * Money on this device: expenses and budget lines straight from Dexie,
 * every write optimistic (the row lands as `pending` with its mutation in
 * the outbox in one transaction) so a quick expense works offline. The
 * device never invents an exchange rate: an expense in another currency
 * waits for the server to attach the rate of its day (`baseAmountMinor`
 * null, "waiting for rate"), unless the person typed one; an expense in
 * the base currency converts at 1 at once, as the server will. In split
 * mode an expense carries its shares: the device writes the share rows and
 * sends them as the expense's `shares` field, which the server replaces as
 * a whole.
 */
@Injectable({ providedIn: 'root' })
export class MoneyStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly outbox = inject(OutboxStore)
  private readonly sync = inject(SyncService)
  private readonly content = inject(TripContentStore)
  private readonly clock = inject(CLOCK)

  /** The three-tap capture: amount and category, the details later (`needsDetails`). */
  async addQuick(input: QuickExpenseInput): Promise<ExpenseRecord> {
    const now = this.clock()
    const currency = input.currency.toUpperCase()
    const record: ExpenseRecord = {
      id: uuidv7(),
      tripId: input.tripId,
      categoryId: input.categoryId,
      eventId: null,
      amountMinor: input.amountMinor,
      currency,
      fxRate: null,
      fxRateDate: null,
      fxSource: null,
      baseAmountMinor: null,
      spentOn: input.spentOn,
      description: null,
      paidByTravellerId: input.paidByTravellerId,
      needsDetails: true,
      createdBy: null,
      updatedAt: now,
      syncState: 'pending',
    }
    const local = withLocalBase(record, input.baseCurrency)
    const shares = shareRecords(local, input.shares ?? [], now)
    await this.write(
      local,
      {
        entity: 'expense',
        op: 'upsert',
        id: local.id,
        changes: {
          ...pick(record, [
            'categoryId',
            'amountMinor',
            'currency',
            'spentOn',
            'paidByTravellerId',
            'needsDetails',
          ]),
          ...(shares.length > 0 ? { shares: shares.map(wireShare) } : {}),
        },
        changedAt: now,
      },
      shares
    )
    return local
  }

  /**
   * "Mark as settled": the debtor pays the creditor back, recorded as a
   * `settlement` in the base currency that the debtor paid and only the
   * creditor shares, which brings the pair's balance to zero. Budgets,
   * Today and the expense list leave settlements out.
   */
  async settle(input: SettlementInput): Promise<ExpenseRecord> {
    const now = this.clock()
    const record = withLocalBase(
      {
        id: uuidv7(),
        tripId: input.tripId,
        kind: 'settlement',
        categoryId: input.categoryId,
        eventId: null,
        amountMinor: input.amountMinor,
        currency: input.baseCurrency.toUpperCase(),
        fxRate: null,
        fxRateDate: null,
        fxSource: null,
        baseAmountMinor: null,
        spentOn: input.spentOn,
        description: input.description,
        paidByTravellerId: input.fromTravellerId,
        needsDetails: false,
        createdBy: null,
        updatedAt: now,
        syncState: 'pending',
      },
      input.baseCurrency
    )
    const shares = shareRecords(
      record,
      [{ travellerId: input.toTravellerId, shareMinor: input.amountMinor }],
      now
    )
    await this.write(
      record,
      {
        entity: 'expense',
        op: 'upsert',
        id: record.id,
        changes: {
          ...pick(record, [
            'kind',
            'categoryId',
            'amountMinor',
            'currency',
            'spentOn',
            'description',
            'paidByTravellerId',
            'needsDetails',
          ]),
          shares: shares.map(wireShare),
        },
        changedAt: now,
      },
      shares
    )
    return record
  }

  /**
   * Saves the full edit: the changed fields, and the details count as given
   * (`needsDetails: false`). A new amount, currency or day without a typed
   * rate drops the stored one so the server looks the right rate up.
   */
  async update(
    id: string,
    changes: ExpenseChanges,
    baseCurrency: string,
    split?: SplitChoice
  ): Promise<void> {
    const now = this.clock()
    const db = await this.database
    await db.transaction(
      'rw',
      [db.expenses, db.expenseShares, db.travellers, db.outbox],
      async () => {
        const current = await db.expenses.get(id)
        if (!current) {
          throw new Error(`Expense not found on this device: ${id}`)
        }
        const sent: Record<string, unknown> = { ...changes, needsDetails: false }
        const stored = await db.expenseShares.where('expenseId').equals(id).toArray()
        const amount = changes.amountMinor ?? current.amountMinor
        let shares: readonly SplitShare[] | null = split?.shares ?? null
        if (split) {
          sent['paidByTravellerId'] = split.paidByTravellerId
        } else if (amount !== current.amountMinor && stored.length > 0) {
          // The split must still add up: the same people still on the trip, in proportion,
          // the remainder on the payer (everyone on the trip equally when none of them is
          // left; the same people when the device knows no traveller at all).
          const live = new Set(
            (await db.travellers.where('tripId').equals(current.tripId).toArray()).map(
              (row) => row.id
            )
          )
          const staying = stored.filter((share) => live.has(share.travellerId))
          const base =
            staying.length > 0
              ? staying
              : live.size > 0
                ? [...live].map((travellerId) => ({ travellerId, shareMinor: 0 }))
                : stored
          shares = scaleShares(amount, base, current.paidByTravellerId)
        }
        if (shares) {
          const rows = shareRecords(current, shares, now)
          await db.expenseShares.bulkDelete(stored.map((share) => share.id))
          await db.expenseShares.bulkPut(rows)
          sent['shares'] = rows.map(wireShare)
        }
        if ('currency' in changes && changes.currency) {
          sent['currency'] = changes.currency.toUpperCase()
        }
        const next: ExpenseRecord = { ...current, ...(sent as Partial<ExpenseRecord>) }
        const typedRate = 'fxRate' in changes && changes.fxRate
        const moved =
          next.amountMinor !== current.amountMinor ||
          next.currency !== current.currency ||
          next.spentOn !== current.spentOn
        if (typedRate) {
          Object.assign(sent, { fxSource: 'manual', fxRateDate: next.spentOn })
        } else if ('fxRate' in changes || moved) {
          // Back to the provider's rate of the (new) day.
          Object.assign(sent, { fxRate: null, fxSource: null, fxRateDate: null })
        }
        const local = withLocalBase(
          { ...current, ...(sent as Partial<ExpenseRecord>), updatedAt: now, syncState: 'pending' },
          baseCurrency
        )
        await db.expenses.put(local)
        await this.outbox.enqueueMutation(db, current.tripId, {
          entity: 'expense',
          op: 'upsert',
          id,
          changes: sent,
          changedAt: now,
        })
      }
    )
    this.sync.requestPush()
  }

  /** Removes the expense from the device and queues its deletion; returns it for undo. */
  async remove(id: string): Promise<RemovedExpense> {
    const now = this.clock()
    const db = await this.database
    let removed: RemovedExpense | undefined
    await db.transaction('rw', [db.expenses, db.expenseShares, db.outbox], async () => {
      const expense = await db.expenses.get(id)
      if (!expense) {
        throw new Error(`Expense not found on this device: ${id}`)
      }
      const shares = await db.expenseShares.where('expenseId').equals(id).toArray()
      removed = {
        ...expense,
        removedShares: shares.map((share) => ({
          travellerId: share.travellerId,
          shareMinor: share.shareMinor,
        })),
      }
      await db.expenses.delete(id)
      await db.expenseShares.bulkDelete(shares.map((share) => share.id))
      await this.outbox.enqueueMutation(db, removed.tripId, {
        entity: 'expense',
        op: 'delete',
        id,
        changes: {},
        changedAt: now,
      })
    })
    this.sync.requestPush()
    return removed!
  }

  /**
   * Undo of a delete: the expense comes back as a new row (the deleted one
   * may already be a tombstone on the server, and a tombstone always wins)
   * with every field the person gave, rate included.
   */
  async restore(expense: RemovedExpense): Promise<ExpenseRecord> {
    const now = this.clock()
    const { removedShares, ...rest } = expense
    const record: ExpenseRecord = { ...rest, id: uuidv7(), updatedAt: now, syncState: 'pending' }
    const shares = shareRecords(record, removedShares ?? [], now)
    await this.write(
      record,
      {
        entity: 'expense',
        op: 'upsert',
        id: record.id,
        changes: {
          ...pick(record, WRITABLE),
          ...(shares.length > 0 ? { shares: shares.map(wireShare) } : {}),
        },
        changedAt: now,
      },
      shares
    )
    return record
  }

  /** A category's budget in base minor units (null: no budget). */
  async setCategoryBudget(id: string, budgetMinor: number | null): Promise<void> {
    const now = this.clock()
    const db = await this.database
    await db.transaction('rw', [db.budgetCategories, db.outbox], async () => {
      const category = await db.budgetCategories.get(id)
      if (!category) {
        throw new Error(`Budget category not found on this device: ${id}`)
      }
      await db.budgetCategories.put({
        ...category,
        budgetMinor,
        updatedAt: now,
        syncState: 'pending',
      })
      await this.outbox.enqueueMutation(db, category.tripId, {
        entity: 'budget_category',
        op: 'upsert',
        id,
        changes: { budgetMinor },
        changedAt: now,
      })
    })
    this.sync.requestPush()
  }

  /** The trip's total budget in base minor units (null: no budget). */
  setTripBudget(tripId: string, budgetTotalMinor: number | null): Promise<void> {
    return this.content.upsert({
      tripId,
      entity: 'trip',
      id: tripId,
      changes: { budgetTotalMinor },
    })
  }

  private async write(
    record: ExpenseRecord,
    mutation: OutboxMutation,
    shares: readonly ExpenseShareRecord[] = []
  ): Promise<void> {
    const db: MonkiTripsDb = await this.database
    await db.transaction('rw', [db.expenses, db.expenseShares, db.outbox], async () => {
      await db.expenses.put(record)
      await db.expenseShares.bulkPut([...shares])
      await this.outbox.enqueueMutation(db, record.tripId, mutation)
    })
    this.sync.requestPush()
  }
}

/**
 * The base amount the device can know without the server: identity for the
 * base currency, the typed rate when there is one, otherwise null (waiting
 * for the rate the server attaches on sync).
 */
function withLocalBase(expense: ExpenseRecord, baseCurrency: string): ExpenseRecord {
  if (expense.currency === baseCurrency.toUpperCase()) {
    return {
      ...expense,
      fxRate: '1',
      fxSource: 'identity',
      fxRateDate: expense.spentOn,
      baseAmountMinor: expense.amountMinor,
    }
  }
  if (expense.fxRate) {
    return {
      ...expense,
      baseAmountMinor: Number(
        convertToBase({
          amountMinor: expense.amountMinor,
          currency: expense.currency,
          baseCurrency,
          rate: expense.fxRate,
        })
      ),
    }
  }
  return { ...expense, baseAmountMinor: null }
}

/** Share rows of `expense` with fresh ids, pending like the expense itself. */
function shareRecords(
  expense: Pick<ExpenseRecord, 'id' | 'tripId'>,
  shares: readonly SplitShare[],
  now: string
): ExpenseShareRecord[] {
  return shares.map((share) => ({
    id: uuidv7(),
    tripId: expense.tripId,
    expenseId: expense.id,
    travellerId: share.travellerId,
    shareMinor: share.shareMinor,
    updatedAt: now,
    syncState: 'pending',
  }))
}

/** A share as the expense's `shares` field carries it. */
function wireShare(share: ExpenseShareRecord): {
  id: string
  travellerId: string
  shareMinor: number
} {
  return { id: share.id, travellerId: share.travellerId, shareMinor: share.shareMinor }
}

function pick(record: ExpenseRecord, fields: readonly string[]): Record<string, unknown> {
  const source = record as unknown as Record<string, unknown>
  return Object.fromEntries(fields.map((field) => [field, source[field]]))
}
