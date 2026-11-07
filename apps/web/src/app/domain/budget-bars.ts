import { toMinor } from '@monkitrips/shared'

/** What a budget line needs from a category row. */
export interface BudgetLine {
  id: string
  key: string | null
  name: string | null
  budgetMinor: number | null
  position: number
}

/** What a budget line needs from an expense. */
export interface BarExpense {
  categoryId: string | null
  /** Null while the expense waits for a rate: left out of the sum, counted. */
  baseAmountMinor: number | null
}

/**
 * One bar of the budget chart (and one row of its table view): the
 * category, what was spent in base minor units, the budget it has, if
 * any, and how full the bar is. `categoryId` null is the trailing row for
 * expenses without a category, present only when there are some.
 */
export interface BudgetBar {
  categoryId: string | null
  key: string | null
  name: string | null
  budgetMinor: bigint | null
  spentMinor: bigint
  /** Expenses of this category still waiting for a rate. */
  pendingFxCount: number
  /** spent / budget, unclamped (1.2 is 20 % over); null without a budget. */
  fraction: number | null
  overBudget: boolean
}

/**
 * The budget by category: one bar per live category in position order,
 * spent summed from the expenses with a base amount, plus a row for
 * expenses without a category. A category without a budget shows its
 * spend honestly, with no fraction to draw. Pure.
 */
export function budgetBars(
  categories: readonly BudgetLine[],
  expenses: readonly BarExpense[]
): BudgetBar[] {
  const spent = new Map<string | null, { minor: bigint; pending: number }>()
  const tally = (categoryId: string | null) => {
    const entry = spent.get(categoryId) ?? { minor: 0n, pending: 0 }
    spent.set(categoryId, entry)
    return entry
  }
  const known = new Set(categories.map((category) => category.id))
  for (const expense of expenses) {
    const categoryId =
      expense.categoryId !== null && known.has(expense.categoryId) ? expense.categoryId : null
    const entry = tally(categoryId)
    if (expense.baseAmountMinor === null) {
      entry.pending += 1
    } else {
      entry.minor += toMinor(expense.baseAmountMinor)
    }
  }
  const bars = [...categories]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((category) => bar(category.id, category, spent.get(category.id)))
  const uncategorised = spent.get(null)
  if (uncategorised) {
    bars.push(
      bar(null, { id: '', key: null, name: null, budgetMinor: null, position: 0 }, uncategorised)
    )
  }
  return bars
}

function bar(
  categoryId: string | null,
  category: BudgetLine,
  entry: { minor: bigint; pending: number } | undefined
): BudgetBar {
  const budgetMinor = category.budgetMinor === null ? null : toMinor(category.budgetMinor)
  const spentMinor = entry?.minor ?? 0n
  const fraction =
    budgetMinor === null || budgetMinor === 0n ? null : Number(spentMinor) / Number(budgetMinor)
  return {
    categoryId,
    key: category.key,
    name: category.name,
    budgetMinor,
    spentMinor,
    pendingFxCount: entry?.pending ?? 0,
    fraction,
    overBudget: budgetMinor !== null && spentMinor > budgetMinor,
  }
}
