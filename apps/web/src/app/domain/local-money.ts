import { divideHalfEven, minorUnitExponent, parseDecimal } from '@monkitrips/shared'
import { currencyForCountry } from './currency-for-country'

/**
 * "Left today" in the money people hold in their hands: the currency of the
 * country Today is in (`currency-for-country`), at the trip's own frozen
 * rate, the one of the latest expense paid in that currency (never a live
 * rate). Without a known currency, or before any expense in it, there is
 * no local amount and the screen shows the base currency alone. Pure.
 */
export interface RatedExpense {
  currency: string
  /** Units of `currency` per 1 base unit, a decimal string. */
  fxRate: string | null
  spentOn: string
  updatedAt: string
}

export interface LocalRate {
  currency: string
  rate: string
}

export function localRate(
  expenses: readonly RatedExpense[],
  baseCurrency: string,
  countryCode: string | null | undefined
): LocalRate | null {
  const currency = currencyForCountry(countryCode)
  if (!currency || currency === baseCurrency) {
    return null
  }
  const rated = expenses
    .filter((expense) => expense.currency === currency && expense.fxRate)
    .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.updatedAt.localeCompare(a.updatedAt))[0]
  return rated?.fxRate ? { currency, rate: rated.fxRate } : null
}

/**
 * Base minor units in another currency at `rate` (units of that currency
 * per 1 base unit), rounded half to even like `convert_to_base`.
 */
export function fromBaseMinor(baseMinor: bigint, baseCurrency: string, target: LocalRate): bigint {
  const { digits, scale } = parseDecimal(target.rate)
  const shift =
    minorUnitExponent(target.currency).exponent - minorUnitExponent(baseCurrency).exponent
  let numerator = baseMinor * digits
  let denominator = 10n ** BigInt(scale)
  if (shift >= 0) {
    numerator *= 10n ** BigInt(shift)
  } else {
    denominator *= 10n ** BigInt(-shift)
  }
  return divideHalfEven(numerator, denominator)
}
