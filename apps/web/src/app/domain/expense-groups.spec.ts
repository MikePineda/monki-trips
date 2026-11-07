import { expensePhase, groupExpensesByDay, type GroupableExpense } from './expense-groups'

const trip = { startsOn: '2027-01-20', endsOn: '2027-01-24' }

function expense(
  id: string,
  spentOn: string,
  categoryId: string | null = 'c-food',
  updatedAt = '2026-11-07T10:00:00.000Z'
): GroupableExpense {
  return { id, spentOn, categoryId, updatedAt }
}

describe('expensePhase', () => {
  it('is before, during or after the trip dates, both ends included in during', () => {
    expect(expensePhase('2026-12-01', trip)).toBe('before')
    expect(expensePhase('2027-01-20', trip)).toBe('during')
    expect(expensePhase('2027-01-24', trip)).toBe('during')
    expect(expensePhase('2027-01-25', trip)).toBe('after')
  })
})

describe('groupExpensesByDay', () => {
  it('groups expenses by day newest first with the phase of each day', () => {
    const groups = groupExpensesByDay(
      [
        expense('flight', '2026-12-01'),
        expense('lunch', '2027-01-21', 'c-food', '2026-11-07T12:00:00.000Z'),
        expense('train', '2027-01-21', 'c-transport', '2026-11-07T13:00:00.000Z'),
        expense('souvenir', '2027-01-23'),
      ],
      trip
    )

    expect(groups.map((group) => [group.date, group.phase])).toEqual([
      ['2027-01-23', 'during'],
      ['2027-01-21', 'during'],
      ['2026-12-01', 'before'],
    ])
    // Inside a day the latest change comes first.
    expect(groups[1].expenses.map((item) => item.id)).toEqual(['train', 'lunch'])
  })

  it('filters by category and phase before grouping', () => {
    const rows = [
      expense('flight', '2026-12-01', 'c-transport'),
      expense('lunch', '2027-01-21', 'c-food'),
      expense('train', '2027-01-21', 'c-transport'),
      expense('tip', '2027-01-22', null),
    ]

    expect(
      groupExpensesByDay(rows, trip, { categoryIds: new Set(['c-transport']) }).flatMap((group) =>
        group.expenses.map((item) => item.id)
      )
    ).toEqual(['train', 'flight'])
    expect(
      groupExpensesByDay(rows, trip, { phases: new Set(['before']) }).map((group) => group.date)
    ).toEqual(['2026-12-01'])
    expect(
      groupExpensesByDay(rows, trip, { categoryIds: new Set([null]) }).flatMap((group) =>
        group.expenses.map((item) => item.id)
      )
    ).toEqual(['tip'])
    expect(
      groupExpensesByDay(rows, trip, {
        categoryIds: new Set(['c-transport']),
        phases: new Set(['during']),
      }).flatMap((group) => group.expenses.map((item) => item.id))
    ).toEqual(['train'])
  })

  it('an empty filter set keeps everything', () => {
    expect(
      groupExpensesByDay([expense('a', '2027-01-21')], trip, {
        categoryIds: new Set(),
        phases: new Set(),
      })
    ).toHaveLength(1)
  })
})
