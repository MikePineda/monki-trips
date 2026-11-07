import { budgetBars, type BudgetLine } from './budget-bars'

const categories: BudgetLine[] = [
  { id: 'c-transport', key: 'transport', name: null, budgetMinor: 10000, position: 1 },
  { id: 'c-food', key: 'food', name: null, budgetMinor: 20000, position: 0 },
  { id: 'c-gifts', key: null, name: 'Gifts', budgetMinor: null, position: 2 },
]

describe('budgetBars', () => {
  it('sums spend per category in position order with the fraction of its budget', () => {
    const bars = budgetBars(categories, [
      { categoryId: 'c-food', baseAmountMinor: 5000 },
      { categoryId: 'c-food', baseAmountMinor: 2500 },
      { categoryId: 'c-transport', baseAmountMinor: 12000 },
    ])

    expect(bars.map((bar) => bar.categoryId)).toEqual(['c-food', 'c-transport', 'c-gifts'])
    expect(bars[0]).toMatchObject({ spentMinor: 7500n, budgetMinor: 20000n, fraction: 0.375 })
    expect(bars[1]).toMatchObject({ spentMinor: 12000n, fraction: 1.2, overBudget: true })
  })

  it('is honest about a category without a budget: spend shown, nothing to fill', () => {
    const bars = budgetBars(categories, [{ categoryId: 'c-gifts', baseAmountMinor: 900 }])

    expect(bars[2]).toMatchObject({
      spentMinor: 900n,
      budgetMinor: null,
      fraction: null,
      overBudget: false,
    })
  })

  it('counts expenses waiting for a rate without summing them, and refunds subtract', () => {
    const bars = budgetBars(categories, [
      { categoryId: 'c-food', baseAmountMinor: null },
      { categoryId: 'c-food', baseAmountMinor: 3000 },
      { categoryId: 'c-food', baseAmountMinor: -1000 },
    ])

    expect(bars[0]).toMatchObject({ spentMinor: 2000n, pendingFxCount: 1 })
  })

  it('adds a trailing row for expenses without a known category only when there are some', () => {
    expect(budgetBars(categories, []).map((bar) => bar.categoryId)).not.toContain(null)

    const bars = budgetBars(categories, [
      { categoryId: null, baseAmountMinor: 400 },
      { categoryId: 'deleted', baseAmountMinor: 100 },
    ])
    expect(bars.at(-1)).toMatchObject({ categoryId: null, spentMinor: 500n, budgetMinor: null })
  })
})
