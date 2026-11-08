import { inject } from '@adonisjs/core'
import type { BudgetCategory, Expense } from '@monkitrips/shared'
import type Trip from '#models/trip'
import { TripSnapshot } from '#services/trip_snapshot'
import { expensesCsv, type CsvExpense } from '#domain/expenses_csv'

/**
 * The live expenses of a trip as Trip expenses CSV v1: oldest first (day,
 * then id, which is time-ordered), settlements included and marked,
 * deleted rows never. Categories are their default key or custom name;
 * people are their traveller display names, `split_with` in trip order
 * (position, then who joined first).
 */
@inject()
export class TripExpensesCsv {
  constructor(private readonly snapshots: TripSnapshot) {}

  async build(trip: Trip): Promise<string> {
    const snapshot = await this.snapshots.build(trip)
    const travellers = new Map(snapshot.travellers.map((row) => [row.id, row]))
    const categories = new Map(snapshot.budgetCategories.map((row) => [row.id, row]))
    const shares = new Map<string, string[]>()
    for (const share of snapshot.expenseShares) {
      const list = shares.get(share.expenseId) ?? []
      list.push(share.travellerId)
      shares.set(share.expenseId, list)
    }
    // Trip order: position, then who joined first (`createdAt`), then id.
    const order = new Map(
      [...snapshot.travellers]
        .sort(
          (a, b) =>
            a.position - b.position ||
            (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
            a.id.localeCompare(b.id)
        )
        .map((row, index) => [row.id, index])
    )
    const position = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER
    const name = (id: string | null) => (id ? (travellers.get(id)?.displayName ?? null) : null)
    const rows: CsvExpense[] = [...snapshot.expenses]
      .filter((expense) => !expense.deletedAt)
      .sort((a, b) => a.spentOn.localeCompare(b.spentOn) || a.id.localeCompare(b.id))
      .map((expense: Expense) => ({
        spentOn: expense.spentOn,
        description: expense.description,
        category: categoryLabel(
          expense.categoryId ? categories.get(expense.categoryId) : undefined
        ),
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        baseAmountMinor: expense.baseAmountMinor,
        baseCurrency: snapshot.trip.baseCurrency,
        fxRate: expense.fxRate,
        paidBy: name(expense.paidByTravellerId),
        splitWith: (shares.get(expense.id) ?? [])
          .sort((a, b) => position(a) - position(b) || a.localeCompare(b))
          .map((id) => name(id))
          .filter((value): value is string => value !== null),
        kind: expense.kind ?? 'expense',
        trip: snapshot.trip.name,
      }))
    return expensesCsv(rows)
  }
}

function categoryLabel(category: BudgetCategory | undefined): string | null {
  if (!category) {
    return null
  }
  return category.key ?? category.name
}
