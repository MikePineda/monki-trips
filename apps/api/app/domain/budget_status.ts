import { DateTime } from 'luxon'
import type { TripBudgetView, EventStatus } from '@monkitrips/shared'

export interface BudgetExpense {
  categoryId: string | null
  /** Converted amount, or null while the rate is missing. */
  baseAmountMinor: number | null
  spentOn: string
}

export interface BudgetEvent {
  status: EventStatus
  costMinor: number | null
  costCurrency: string | null
}

export interface BudgetCategoryLine {
  id: string
  budgetMinor: number | null
}

export interface BudgetStatusInput {
  baseCurrency: string
  budgetMinor: number | null
  startsOn: string
  endsOn: string
  /** Today's date (`YYYY-MM-DD`) in the trip's zone. */
  today: string
  expenses: BudgetExpense[]
  events: BudgetEvent[]
  categories: BudgetCategoryLine[]
}

/** Event statuses whose cost counts as committed money. */
const COMMITTED: ReadonlySet<EventStatus> = new Set(['booked', 'paid'])

function daysBetween(from: string, to: string): number {
  return DateTime.fromISO(to, { zone: 'utc' }).diff(DateTime.fromISO(from, { zone: 'utc' }), 'days')
    .days
}

/**
 * The budget position. `remaining = budget - spent`;
 * `allowanceToday = floor((budget - spentBeforeToday) / daysLeftIncludingToday)`,
 * spread over the whole trip before it starts and null once it is over;
 * `leftToday = allowanceToday - spentToday`. Expenses still waiting for a
 * rate are excluded from every sum and counted in `pendingFxCount`.
 * Committed money is the cost of booked and paid events priced in the base
 * currency (foreign costs need a rate the event does not store).
 * Mirrors the shared `budget_status`.
 */
export function budgetStatus(input: BudgetStatusInput): TripBudgetView {
  const converted = input.expenses.filter(
    (expense): expense is BudgetExpense & { baseAmountMinor: number } =>
      expense.baseAmountMinor !== null
  )
  const sum = (items: { baseAmountMinor: number }[]) =>
    items.reduce((total, item) => total + item.baseAmountMinor, 0)
  const spentMinor = sum(converted)
  const spentTodayMinor = sum(converted.filter((expense) => expense.spentOn === input.today))
  const spentBeforeToday = sum(converted.filter((expense) => expense.spentOn < input.today))
  const pendingFxCount = input.expenses.length - converted.length

  const budget = input.budgetMinor
  const remainingMinor = budget === null ? null : budget - spentMinor

  let allowanceTodayMinor: number | null = null
  if (budget !== null) {
    const totalDays = daysBetween(input.startsOn, input.endsOn) + 1
    if (input.today < input.startsOn) {
      allowanceTodayMinor = Math.floor((budget - spentBeforeToday) / totalDays)
    } else if (input.today <= input.endsOn) {
      const daysLeft = daysBetween(input.today, input.endsOn) + 1
      allowanceTodayMinor = Math.floor((budget - spentBeforeToday) / daysLeft)
    }
  }
  const leftTodayMinor = allowanceTodayMinor === null ? null : allowanceTodayMinor - spentTodayMinor

  const committedMinor = input.events
    .filter(
      (event) =>
        COMMITTED.has(event.status) &&
        event.costMinor !== null &&
        event.costCurrency === input.baseCurrency
    )
    .reduce((total, event) => total + (event.costMinor ?? 0), 0)

  const perCategory = input.categories.map((category) => ({
    categoryId: category.id as string | null,
    budgetMinor: category.budgetMinor,
    spentMinor: sum(converted.filter((expense) => expense.categoryId === category.id)),
  }))
  const uncategorised = converted.filter(
    (expense) =>
      expense.categoryId === null || !input.categories.some((c) => c.id === expense.categoryId)
  )
  if (uncategorised.length > 0) {
    perCategory.push({ categoryId: null, budgetMinor: null, spentMinor: sum(uncategorised) })
  }

  return {
    baseCurrency: input.baseCurrency,
    budgetMinor: budget,
    spentMinor,
    remainingMinor,
    allowanceTodayMinor,
    spentTodayMinor,
    leftTodayMinor,
    pendingFxCount,
    committedMinor,
    perCategory,
  }
}
