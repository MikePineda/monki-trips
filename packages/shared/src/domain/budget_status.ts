/**
 * The money view of a trip for one `today`, in base minor units:
 *
 *   remaining        = B − S                       (S: every expense with a base amount)
 *   allowance_today  = floor((B − S_before_today) / days_left_incl_today)   during the trip
 *                    = floor((B − S) / total_days)                           before the trip
 *                    = null                                                  after the trip
 *   left_today       = allowance_today − spent_today
 *
 * Expenses still waiting for an FX rate (`baseAmountMinor: null`) are left
 * out of every sum and counted in `pendingFxCount`. Expenses queued offline
 * (`syncPending`) count like any other. An expense dated outside the trip
 * (a flight bought months before) still counts in `spent`. `committedMinor`
 * is the cost of active priced events that no expense has recorded yet.
 */
import { convertToBase } from './convert_to_base.ts'
import { compareIsoDate, daysBetween, type IsoDate } from './iso_date.ts'
import { floorDiv, toMinor, type MinorUnits } from './minor_units.ts'
import { tripPhase, tripTotalDays, type TripDates, type TripPhase } from './trip_dates.ts'
import { isActiveEvent, type TripEvent } from './trip_event.ts'

export interface BudgetExpense {
  id?: string
  eventId?: string | null
  amountMinor: MinorUnits
  currency: string
  /** Null while the expense waits for a rate (quick capture offline). */
  baseAmountMinor: MinorUnits | null
  spentOn: IsoDate
  /** True for an expense still in the outbox; it counts all the same. */
  syncPending?: boolean
}

export type PricedEvent = Pick<TripEvent, 'id' | 'status' | 'costMinor' | 'costCurrency'>

export interface BudgetStatusInput extends TripDates {
  budgetTotalMinor: MinorUnits | null
  baseCurrency: string
  today: IsoDate
  expenses: readonly BudgetExpense[]
  /** Events with a price; those without an expense are "committed". */
  events?: readonly PricedEvent[]
  /** Rates as `convert_to_base` takes them, by currency code, for committed costs in another currency. */
  rates?: Readonly<Record<string, string>>
}

export interface BudgetStatus {
  phase: TripPhase
  budgetMinor: bigint | null
  spentMinor: bigint
  remainingMinor: bigint | null
  allowanceTodayMinor: bigint | null
  spentTodayMinor: bigint
  leftTodayMinor: bigint | null
  /** Expenses without a base amount, left out of the sums. */
  pendingFxCount: number
  /** Expenses still queued for sync, included in the sums. */
  pendingSyncCount: number
  /** Cost of active priced events that no expense covers yet, in base minor units. */
  committedMinor: bigint
  /** Committed costs in a currency without a rate, left out of `committedMinor`. */
  committedPendingFxCount: number
  /** Days from today to the last day, both included; 0 after the trip. */
  daysLeftInclToday: number
}

export function budgetStatus(input: BudgetStatusInput): BudgetStatus {
  const phase = tripPhase(input, input.today)
  const budget = input.budgetTotalMinor === null ? null : toMinor(input.budgetTotalMinor)

  let spent = 0n
  let spentBeforeToday = 0n
  let spentToday = 0n
  let pendingFxCount = 0
  let pendingSyncCount = 0
  const expensedEvents = new Set<string>()
  for (const expense of input.expenses) {
    if (expense.eventId) {
      expensedEvents.add(expense.eventId)
    }
    if (expense.syncPending) {
      pendingSyncCount++
    }
    if (expense.baseAmountMinor === null) {
      pendingFxCount++
      continue
    }
    const amount = toMinor(expense.baseAmountMinor)
    spent += amount
    const order = compareIsoDate(expense.spentOn, input.today)
    if (order < 0) {
      spentBeforeToday += amount
    } else if (order === 0) {
      spentToday += amount
    }
  }

  const daysLeftInclToday =
    phase === 'past' ? 0 : Math.max(0, daysBetween(input.today, input.endsOn)) + 1
  let allowance: bigint | null = null
  if (budget !== null && phase === 'ongoing') {
    allowance = floorDiv(budget - spentBeforeToday, BigInt(daysLeftInclToday))
  } else if (budget !== null && phase === 'upcoming') {
    allowance = floorDiv(budget - spent, BigInt(tripTotalDays(input)))
  }

  let committed = 0n
  let committedPendingFxCount = 0
  for (const event of input.events ?? []) {
    if (!isActiveEvent(event) || event.costMinor === null || event.costMinor === undefined) {
      continue
    }
    if (expensedEvents.has(event.id)) {
      continue
    }
    const currency = event.costCurrency ?? input.baseCurrency
    if (currency === input.baseCurrency) {
      committed += toMinor(event.costMinor)
      continue
    }
    const rate = input.rates?.[currency]
    if (rate === undefined) {
      committedPendingFxCount++
      continue
    }
    committed += convertToBase({
      amountMinor: event.costMinor,
      currency,
      baseCurrency: input.baseCurrency,
      rate,
    })
  }

  return {
    phase,
    budgetMinor: budget,
    spentMinor: spent,
    remainingMinor: budget === null ? null : budget - spent,
    allowanceTodayMinor: allowance,
    spentTodayMinor: spentToday,
    leftTodayMinor: allowance === null ? null : allowance - spentToday,
    pendingFxCount,
    pendingSyncCount,
    committedMinor: committed,
    committedPendingFxCount,
    daysLeftInclToday,
  }
}
