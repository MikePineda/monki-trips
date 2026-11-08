import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetStatus, type BudgetExpense } from './budget_status.ts'

// Twelve days, base AUD, 1200.00 of budget.
const trip = { startsOn: '2026-01-10', endsOn: '2026-01-21', baseCurrency: 'AUD' }
const budget = { ...trip, budgetTotalMinor: 120_000n }

function expense(
  spentOn: string,
  baseAmountMinor: bigint | null,
  extra: Partial<BudgetExpense> = {}
): BudgetExpense {
  return {
    amountMinor: baseAmountMinor ?? 0n,
    currency: 'AUD',
    baseAmountMinor,
    spentOn,
    ...extra,
  }
}

const beforeToday = [
  expense('2026-01-10', 10_000n),
  expense('2026-01-11', 5_000n),
  expense('2026-01-12', 15_000n),
]

test('remaining per day spreads what is left over days left including today', () => {
  // Day 4 of 12: nine days left, 300.00 spent before today, 20.00 today.
  const status = budgetStatus({
    ...budget,
    today: '2026-01-13',
    expenses: [...beforeToday, expense('2026-01-13', 2_000n)],
  })
  assert.equal(status.phase, 'ongoing')
  assert.equal(status.daysLeftInclToday, 9)
  assert.equal(status.spentMinor, 32_000n)
  assert.equal(status.remainingMinor, 88_000n)
  assert.equal(status.allowanceTodayMinor, 10_000n)
  assert.equal(status.spentTodayMinor, 2_000n)
  assert.equal(status.leftTodayMinor, 8_000n)
})

test('expenses waiting for a rate are excluded and counted', () => {
  const status = budgetStatus({
    ...budget,
    today: '2026-01-13',
    expenses: [
      ...beforeToday,
      expense('2026-01-13', null, { amountMinor: 350_000n, currency: 'THB' }),
      expense('2026-01-13', 2_000n, { syncPending: true }),
    ],
  })
  assert.equal(status.pendingFxCount, 1)
  assert.equal(status.pendingSyncCount, 1)
  assert.equal(status.spentMinor, 32_000n)
  assert.equal(status.leftTodayMinor, 8_000n)
})

test('over budget yields negative allowance', () => {
  const status = budgetStatus({
    ...trip,
    budgetTotalMinor: 10_000n,
    today: '2026-01-13',
    expenses: [expense('2026-01-11', 50_000n)],
  })
  assert.equal(status.remainingMinor, -40_000n)
  // floor(−40000 / 9) rounds toward negative infinity.
  assert.equal(status.allowanceTodayMinor, -4_445n)
  assert.equal(status.leftTodayMinor, -4_445n)
})

test('no budget yields null', () => {
  const status = budgetStatus({
    ...trip,
    budgetTotalMinor: null,
    today: '2026-01-13',
    expenses: [...beforeToday, expense('2026-01-13', 2_000n)],
  })
  assert.equal(status.budgetMinor, null)
  assert.equal(status.remainingMinor, null)
  assert.equal(status.allowanceTodayMinor, null)
  assert.equal(status.leftTodayMinor, null)
  assert.equal(status.spentMinor, 32_000n)
  assert.equal(status.spentTodayMinor, 2_000n)
})

test('before the trip the allowance spreads what is left over the whole trip', () => {
  const status = budgetStatus({
    ...budget,
    today: '2026-01-05',
    expenses: [expense('2025-12-20', 30_000n)],
  })
  assert.equal(status.phase, 'upcoming')
  assert.equal(status.daysLeftInclToday, 17)
  assert.equal(status.allowanceTodayMinor, 7_500n)
  assert.equal(status.leftTodayMinor, 7_500n)
})

test('after the trip there is no allowance, only the balance', () => {
  const status = budgetStatus({ ...budget, today: '2026-02-01', expenses: beforeToday })
  assert.equal(status.phase, 'past')
  assert.equal(status.daysLeftInclToday, 0)
  assert.equal(status.allowanceTodayMinor, null)
  assert.equal(status.leftTodayMinor, null)
  assert.equal(status.remainingMinor, 90_000n)
  assert.equal(status.allowanceDays, 0)
})

test('before the trip the allowance spreads over the trip days', () => {
  // 18 days that start 82 days from today: 100 days left, yet the allowance
  // divides by the 18 days of the trip, and says so.
  const status = budgetStatus({
    startsOn: '2027-01-29',
    endsOn: '2027-02-15',
    baseCurrency: 'AUD',
    budgetTotalMinor: 794_860n,
    today: '2026-11-08',
    expenses: [expense('2026-11-05', 317_548n)],
  })
  assert.equal(status.phase, 'upcoming')
  assert.equal(status.daysLeftInclToday, 100)
  assert.equal(status.allowanceDays, 18)
  assert.equal(status.allowanceTodayMinor, 26_517n)
})

test('during the trip the allowance spreads over the days left including today', () => {
  const status = budgetStatus({ ...budget, today: '2026-01-13', expenses: beforeToday })
  assert.equal(status.allowanceDays, 9)
  assert.equal(status.allowanceTodayMinor, 10_000n)
})

test('an expense outside the trip range still counts as spent', () => {
  const status = budgetStatus({
    ...budget,
    today: '2026-01-13',
    expenses: [expense('2025-11-02', 40_000n), expense('2026-03-01', 1_000n)],
  })
  assert.equal(status.spentMinor, 41_000n)
  assert.equal(status.spentTodayMinor, 0n)
  // Only what was spent before today lowers the allowance.
  assert.equal(status.allowanceTodayMinor, 8_888n)
})

test('a negative refund lowers what was spent', () => {
  const status = budgetStatus({
    ...budget,
    today: '2026-01-13',
    expenses: [expense('2026-01-12', 10_000n), expense('2026-01-13', -2_500n)],
  })
  assert.equal(status.spentMinor, 7_500n)
  assert.equal(status.spentTodayMinor, -2_500n)
  assert.equal(status.leftTodayMinor, status.allowanceTodayMinor! + 2_500n)
})

test('committed is the cost of priced events without an expense, converted when a rate is known', () => {
  const status = budgetStatus({
    ...budget,
    today: '2026-01-13',
    expenses: [expense('2026-01-10', 50_000n, { eventId: 'flight-out' })],
    events: [
      { id: 'flight-out', status: 'paid', costMinor: 50_000n, costCurrency: 'AUD' },
      { id: 'hotel-b', status: 'booked', costMinor: 20_000n, costCurrency: 'AUD' },
      { id: 'ryokan', status: 'booked', costMinor: 30_000n, costCurrency: 'JPY' },
      { id: 'cooking-class', status: 'to_book', costMinor: 150_000n, costCurrency: 'THB' },
      { id: 'cancelled-tour', status: 'cancelled', costMinor: 9_999n, costCurrency: 'AUD' },
      { id: 'maybe-dinner', status: 'idea', costMinor: 9_999n, costCurrency: 'AUD' },
      { id: 'free-walk', status: 'booked', costMinor: null, costCurrency: null },
    ],
    rates: { JPY: '100' },
  })
  // 200.00 AUD hotel + 30000 JPY at 100 per AUD = 300.00 AUD; the THB class waits for a rate.
  assert.equal(status.committedMinor, 50_000n)
  assert.equal(status.committedPendingFxCount, 1)
})

test('amounts may arrive as strings or numbers', () => {
  const status = budgetStatus({
    ...trip,
    budgetTotalMinor: '120000',
    today: '2026-01-13',
    expenses: [
      expense('2026-01-12', 1_000n, { baseAmountMinor: '1000' }),
      expense('2026-01-13', 5n, { baseAmountMinor: 5 }),
    ],
  })
  assert.equal(status.spentMinor, 1_005n)
})
