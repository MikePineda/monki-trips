/**
 * The defaults the quick expense opens with, so that amount and "Save"
 * are enough: the category is the one used last or, with none, the one
 * the time of day suggests; the currency is the one of the stop the day
 * is spent in, else the trip's base. Pure.
 */
import { currencyForCountry } from './currency-for-country'
import { stopForDate, type DatedStop } from './stop-for-date'

/** The default category keys of every trip, by the hour of the day a quick expense is logged. */
export function categoryKeyForHour(localHour: number): string {
  if (localHour >= 7 && localHour < 10) return 'food'
  if (localHour >= 12 && localHour < 14) return 'food'
  if (localHour >= 18 && localHour < 22) return 'food'
  if (localHour >= 5 && localHour < 7) return 'transport'
  if (localHour >= 10 && localHour < 18) return 'activities'
  return 'other'
}

export interface DefaultCategoryInput {
  /** The category of the expense logged last on this trip, if any. */
  lastUsedId: string | null
  /** Hour of the day in the place's zone, 0–23. */
  localHour: number
  /** The trip's live categories: `key` for a default one, null for a custom one. */
  categories: readonly { id: string; key: string | null }[]
}

/** The category id the sheet preselects, or null when the trip has none. */
export function defaultCategoryId(input: DefaultCategoryInput): string | null {
  const last = input.categories.find((category) => category.id === input.lastUsedId)
  if (last) {
    return last.id
  }
  const suggested = categoryKeyForHour(input.localHour)
  const byHour = input.categories.find((category) => category.key === suggested)
  return byHour?.id ?? input.categories[0]?.id ?? null
}

/** The currency of the stop the date is spent in, else the base currency. */
export function defaultCurrency(
  stops: readonly DatedStop[],
  date: string,
  baseCurrency: string
): string {
  const stop = stopForDate(stops, date)
  return currencyForCountry(stop?.countryCode) ?? baseCurrency
}
