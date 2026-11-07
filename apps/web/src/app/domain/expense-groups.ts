import { compareIsoDate, type IsoDate, type TripDates } from '@monkitrips/shared'

/** When an expense happened relative to the trip: bought before, spent on the road, or settled after. */
export const EXPENSE_PHASES = ['before', 'during', 'after'] as const

export type ExpensePhase = (typeof EXPENSE_PHASES)[number]

/** What the list needs from an expense. */
export interface GroupableExpense {
  id: string
  categoryId: string | null
  spentOn: IsoDate
  updatedAt: string
}

export interface ExpenseFilters {
  /** Keep only these categories (`null` is "no category"); empty = every category. */
  categoryIds?: ReadonlySet<string | null>
  /** Keep only these phases; empty = every phase. */
  phases?: ReadonlySet<ExpensePhase>
}

export interface ExpenseDayGroup<E extends GroupableExpense> {
  date: IsoDate
  phase: ExpensePhase
  expenses: E[]
}

/** The phase of a date against the trip's dates. Pure. */
export function expensePhase(spentOn: IsoDate, trip: TripDates): ExpensePhase {
  if (compareIsoDate(spentOn, trip.startsOn) < 0) return 'before'
  if (compareIsoDate(spentOn, trip.endsOn) > 0) return 'after'
  return 'during'
}

/**
 * The expense list: one group per day, newest day first, each group tagged
 * with its phase; inside a day the latest change comes first. Filters by
 * category and phase apply before grouping, so an empty result means
 * "nothing matches", not "nothing yet". Pure.
 */
export function groupExpensesByDay<E extends GroupableExpense>(
  expenses: readonly E[],
  trip: TripDates,
  filters: ExpenseFilters = {}
): ExpenseDayGroup<E>[] {
  const byDate = new Map<IsoDate, E[]>()
  for (const expense of expenses) {
    if (filters.categoryIds?.size && !filters.categoryIds.has(expense.categoryId)) continue
    const phase = expensePhase(expense.spentOn, trip)
    if (filters.phases?.size && !filters.phases.has(phase)) continue
    const group = byDate.get(expense.spentOn) ?? []
    group.push(expense)
    byDate.set(expense.spentOn, group)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => compareIsoDate(b, a))
    .map(([date, group]) => ({
      date,
      phase: expensePhase(date, trip),
      expenses: group.sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)
      ),
    }))
}
