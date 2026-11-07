/**
 * How a trip's money is tracked, mirrored by the CHECK constraint on
 * `trips.budget_mode`: one shared pot, or split between travellers.
 */
export const BUDGET_MODES = ['shared', 'split'] as const

export type BudgetMode = (typeof BUDGET_MODES)[number]
