/**
 * Where an exchange rate came from, mirrored by the CHECK constraint on
 * `expenses.fx_source`: fetched from the rate provider, typed by hand
 * (fixed at booking), or 1 because the expense is in the base currency.
 */
export const FX_SOURCES = ['frankfurter', 'manual', 'identity'] as const

export type FxSource = (typeof FX_SOURCES)[number]

/** The default categories every trip starts with (`budget_categories.key`). */
export const DEFAULT_BUDGET_CATEGORY_KEYS = [
  'accommodation',
  'transport',
  'food',
  'activities',
  'shopping',
  'other',
] as const

export type DefaultBudgetCategoryKey = (typeof DEFAULT_BUDGET_CATEGORY_KEYS)[number]

/** A budget line: a default one (`key`, translated by the client) or a custom one (`name`). */
export interface BudgetCategory {
  id: string
  tripId: string
  key: string | null
  name: string | null
  budgetMinor: number | null
  position: number
  deletedAt: string | null
  updatedAt: string
}

/**
 * An expense as the API returns it. `amountMinor` is in `currency` (never 0;
 * negative is a refund); `fxRate` is units of `currency` per 1 base unit as
 * a decimal string; `baseAmountMinor` is derived on the server from the
 * stored rate and is null while the rate is still missing.
 */
export interface Expense {
  id: string
  tripId: string
  categoryId: string | null
  eventId: string | null
  amountMinor: number
  currency: string
  fxRate: string | null
  fxRateDate: string | null
  fxSource: FxSource | null
  baseAmountMinor: number | null
  spentOn: string
  description: string | null
  paidByTravellerId: string | null
  /** Quick capture: the person still has to fill in the details. */
  needsDetails: boolean
  createdBy: string | null
  deletedAt: string | null
  updatedAt: string
}

/** Who owes what of an expense (split mode). The live shares of an expense sum to its amount. */
export interface ExpenseShare {
  id: string
  tripId: string
  expenseId: string
  travellerId: string
  shareMinor: number
  deletedAt: string | null
  updatedAt: string
}

/** One cached exchange rate (`GET /fx/rates`): units of `quote` per 1 `base` on `rateOn`. */
export interface FxRate {
  base: string
  quote: string
  rateOn: string
  /** Decimal string with up to 10 decimals. */
  rate: string
  source: FxSource
}
