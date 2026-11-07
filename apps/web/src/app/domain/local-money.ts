import { divideHalfEven, minorUnitExponent, parseDecimal } from '@monkitrips/shared'

/**
 * "Left today" in the money people hold in their hands. The device keeps
 * no country-to-currency table, so the local currency is the one of the
 * latest expense paid in a foreign currency with a frozen rate (the trip's
 * own exchange rate, never a live one); without such an expense there is
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
  baseCurrency: string
): LocalRate | null {
  const rated = expenses
    .filter((expense) => expense.currency !== baseCurrency && expense.fxRate)
    .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.updatedAt.localeCompare(a.updatedAt))[0]
  return rated?.fxRate ? { currency: rated.currency, rate: rated.fxRate } : null
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
