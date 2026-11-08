import type { BudgetCategory, Expense, ExpenseShare } from '@monkitrips/shared'
import type { BudgetCategoryRecord, ExpenseRecord, ExpenseShareRecord } from './records'

/** The device's row for an expense the API returned (the tombstone left out). Pure. */
export function toExpenseRecord(row: Expense): ExpenseRecord {
  const { deletedAt, ...record } = row
  void deletedAt
  return record
}

/** The device's row for a budget category the API returned (the tombstone left out). Pure. */
export function toBudgetCategoryRecord(row: BudgetCategory): BudgetCategoryRecord {
  const { deletedAt, ...record } = row
  void deletedAt
  return record
}

/** The device's row for an expense share the API returned (the tombstone left out). Pure. */
export function toExpenseShareRecord(row: ExpenseShare): ExpenseShareRecord {
  const { deletedAt, ...record } = row
  void deletedAt
  return record
}
