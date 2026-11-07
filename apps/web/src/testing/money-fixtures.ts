import { DEFAULT_BUDGET_CATEGORY_KEYS, type BudgetCategory, type Expense } from '@monkitrips/shared'
import type { BudgetCategoryRecord, ExpenseRecord } from '../app/core/offline/records'

/** Synthetic money rows for specs: invented amounts, trip `trip-1` unless overridden. */
export function expenseRow(overrides: Partial<Expense> & Pick<Expense, 'id'>): Expense {
  return {
    tripId: 'trip-1',
    categoryId: null,
    eventId: null,
    amountMinor: 1250,
    currency: 'AUD',
    fxRate: '1',
    fxRateDate: '2027-01-21',
    fxSource: 'identity',
    baseAmountMinor: 1250,
    spentOn: '2027-01-21',
    description: null,
    paidByTravellerId: null,
    needsDetails: false,
    createdBy: 'user-1',
    deletedAt: null,
    updatedAt: '2026-11-07T10:00:00.000Z',
    ...overrides,
  }
}

export function expenseRecord(
  overrides: Partial<ExpenseRecord> & Pick<ExpenseRecord, 'id'>
): ExpenseRecord {
  const { deletedAt, ...row } = expenseRow(overrides)
  void deletedAt
  return { ...row, ...overrides }
}

export function budgetCategoryRow(
  overrides: Partial<BudgetCategory> & Pick<BudgetCategory, 'id'>
): BudgetCategory {
  return {
    tripId: 'trip-1',
    key: 'other',
    name: null,
    budgetMinor: null,
    position: 0,
    deletedAt: null,
    updatedAt: '2026-11-07T10:00:00.000Z',
    ...overrides,
  }
}

/** The six default categories of a trip, ids `cat-<key>`. */
export function defaultCategoryRecords(tripId = 'trip-1'): BudgetCategoryRecord[] {
  return DEFAULT_BUDGET_CATEGORY_KEYS.map((key, position) => {
    const { deletedAt, ...row } = budgetCategoryRow({ id: `cat-${key}`, tripId, key, position })
    void deletedAt
    return row
  })
}
