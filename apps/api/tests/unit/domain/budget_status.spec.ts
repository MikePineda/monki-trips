import { test } from '@japa/runner'
import { budgetStatus, type BudgetStatusInput } from '#domain/budget_status'

const BASE: BudgetStatusInput = {
  baseCurrency: 'AUD',
  budgetMinor: 1_000_00,
  startsOn: '2027-01-20',
  endsOn: '2027-01-29',
  today: '2027-01-25',
  expenses: [],
  events: [],
  categories: [{ id: 'food', budgetMinor: 300_00 }],
}

test.group('Budget status', () => {
  test('remaining per day spreads what is left over days left including today', ({ assert }) => {
    const status = budgetStatus({
      ...BASE,
      expenses: [
        { categoryId: 'food', baseAmountMinor: 400_00, spentOn: '2027-01-21' },
        { categoryId: 'food', baseAmountMinor: 50_00, spentOn: '2027-01-25' },
      ],
    })

    // (1000 - 400) / 5 days left (25th to 29th) = 120 a day; 50 spent today.
    assert.equal(status.spentMinor, 450_00)
    assert.equal(status.remainingMinor, 550_00)
    assert.equal(status.allowanceTodayMinor, 120_00)
    assert.equal(status.spentTodayMinor, 50_00)
    assert.equal(status.leftTodayMinor, 70_00)
  })

  test('expenses waiting for a rate are excluded and counted', ({ assert }) => {
    const status = budgetStatus({
      ...BASE,
      expenses: [
        { categoryId: 'food', baseAmountMinor: null, spentOn: '2027-01-25' },
        { categoryId: 'food', baseAmountMinor: 10_00, spentOn: '2027-01-25' },
      ],
    })

    assert.equal(status.pendingFxCount, 1)
    assert.equal(status.spentMinor, 10_00)
    assert.equal(status.perCategory[0].spentMinor, 10_00)
  })

  test('over budget yields negative allowance', ({ assert }) => {
    const status = budgetStatus({
      ...BASE,
      expenses: [{ categoryId: null, baseAmountMinor: 1_500_00, spentOn: '2027-01-21' }],
    })

    assert.isBelow(status.allowanceTodayMinor!, 0)
    assert.equal(status.remainingMinor, -500_00)
  })

  test('no budget yields null', ({ assert }) => {
    const status = budgetStatus({ ...BASE, budgetMinor: null })

    assert.isNull(status.remainingMinor)
    assert.isNull(status.allowanceTodayMinor)
    assert.isNull(status.leftTodayMinor)
  })

  test('before the trip the budget is spread over every day, after it there is no allowance', ({
    assert,
  }) => {
    const before = budgetStatus({ ...BASE, today: '2026-12-01' })
    const after = budgetStatus({ ...BASE, today: '2027-02-10' })

    assert.equal(before.allowanceTodayMinor, 100_00)
    assert.isNull(after.allowanceTodayMinor)
  })

  test('a one-day trip spends its whole budget today', ({ assert }) => {
    const status = budgetStatus({
      ...BASE,
      startsOn: '2027-01-25',
      endsOn: '2027-01-25',
      today: '2027-01-25',
    })

    assert.equal(status.allowanceTodayMinor, 1_000_00)
  })

  test('refunds subtract and committed money counts booked and paid events in the base currency', ({
    assert,
  }) => {
    const status = budgetStatus({
      ...BASE,
      expenses: [
        { categoryId: 'food', baseAmountMinor: 80_00, spentOn: '2027-01-21' },
        { categoryId: 'food', baseAmountMinor: -30_00, spentOn: '2027-01-22' },
      ],
      events: [
        { status: 'booked', costMinor: 200_00, costCurrency: 'AUD' },
        { status: 'paid', costMinor: 100_00, costCurrency: 'AUD' },
        { status: 'paid', costMinor: 9_000, costCurrency: 'JPY' },
        { status: 'to_book', costMinor: 500_00, costCurrency: 'AUD' },
      ],
    })

    assert.equal(status.spentMinor, 50_00)
    assert.equal(status.committedMinor, 300_00)
  })
})
