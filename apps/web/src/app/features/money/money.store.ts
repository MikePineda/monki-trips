import { Injectable, inject } from '@angular/core'
import { convertToBase } from '@monkitrips/shared'
import { v7 as uuidv7 } from 'uuid'
import { CLOCK } from '../../core/offline/clock'
import type { MonkiTripsDb } from '../../core/offline/db'
import type { OutboxMutation } from '../../core/offline/mutation'
import { OFFLINE_DB } from '../../core/offline/offline-db'
import { OutboxStore } from '../../core/offline/outbox.store'
import type { ExpenseRecord } from '../../core/offline/records'
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
 * the base currency converts at 1 at once, as the server will.
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
    await this.write(local, {
      entity: 'expense',
      op: 'upsert',
      id: local.id,
      changes: pick(record, [
        'categoryId',
        'amountMinor',
        'currency',
        'spentOn',
        'paidByTravellerId',
        'needsDetails',
      ]),
      changedAt: now,
    })
    return local
  }

  /**
   * Saves the full edit: the changed fields, and the details count as given
   * (`needsDetails: false`). A new amount, currency or day without a typed
   * rate drops the stored one so the server looks the right rate up.
   */
  async update(id: string, changes: ExpenseChanges, baseCurrency: string): Promise<void> {
    const now = this.clock()
    const db = await this.database
    await db.transaction('rw', [db.expenses, db.outbox], async () => {
      const current = await db.expenses.get(id)
      if (!current) {
        throw new Error(`Expense not found on this device: ${id}`)
      }
      const sent: Record<string, unknown> = { ...changes, needsDetails: false }
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
    })
    this.sync.requestPush()
  }

  /** Removes the expense from the device and queues its deletion; returns it for undo. */
  async remove(id: string): Promise<ExpenseRecord> {
    const now = this.clock()
    const db = await this.database
    let removed: ExpenseRecord | undefined
    await db.transaction('rw', [db.expenses, db.outbox], async () => {
      removed = await db.expenses.get(id)
      if (!removed) {
        throw new Error(`Expense not found on this device: ${id}`)
      }
      await db.expenses.delete(id)
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
  async restore(expense: ExpenseRecord): Promise<ExpenseRecord> {
    const now = this.clock()
    const record: ExpenseRecord = { ...expense, id: uuidv7(), updatedAt: now, syncState: 'pending' }
    await this.write(record, {
      entity: 'expense',
      op: 'upsert',
      id: record.id,
      changes: pick(record, WRITABLE),
      changedAt: now,
    })
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

  private async write(record: ExpenseRecord, mutation: OutboxMutation): Promise<void> {
    const db: MonkiTripsDb = await this.database
    await db.transaction('rw', [db.expenses, db.outbox], async () => {
      await db.expenses.put(record)
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

function pick(record: ExpenseRecord, fields: readonly string[]): Record<string, unknown> {
  const source = record as unknown as Record<string, unknown>
  return Object.fromEntries(fields.map((field) => [field, source[field]]))
}
