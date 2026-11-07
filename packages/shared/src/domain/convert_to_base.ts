/**
 * Converts an amount in minor units of one currency into minor units of the
 * trip's base currency with an FX rate given as a decimal string
 * (`fx_rate numeric(24,10)`: units of the original currency per 1 unit of
 * the base, the `base=<trip base>` format of the rate provider).
 *
 *   base_minor = amount_minor / rate × 10^(expBase − expOrig)
 *
 * Everything is `bigint`; the single division rounds half to even. The rate
 * is never recomputed here: the caller stores the rate it used.
 */
import { minorUnitExponent } from './currency_exponent.ts'
import { divideHalfEven, pow10, toMinor, type MinorUnits } from './minor_units.ts'

export interface ConvertToBaseInput {
  amountMinor: MinorUnits
  /** ISO 4217 code of `amountMinor`. */
  currency: string
  /** ISO 4217 code of the trip's base currency. */
  baseCurrency: string
  /** Decimal string, units of `currency` per 1 `baseCurrency`, e.g. `"23.1234567891"`; `"1"` for the base itself. */
  rate: string
}

export interface DecimalDigits {
  /** The digits of the decimal with the point removed. */
  digits: bigint
  /** How many of those digits were fractional. */
  scale: number
}

const DECIMAL = /^\+?(\d+)(?:\.(\d+))?$/

/** Parses a non-negative decimal string exactly; throws `RangeError` on anything else. */
export function parseDecimal(value: string): DecimalDigits {
  const match = DECIMAL.exec(value.trim())
  if (!match) {
    throw new RangeError(`Invalid decimal: ${JSON.stringify(value)}`)
  }
  const fraction = match[2] ?? ''
  return { digits: BigInt(match[1] + fraction), scale: fraction.length }
}

export function convertToBase(input: ConvertToBaseInput): bigint {
  const amount = toMinor(input.amountMinor)
  const rate = parseDecimal(input.rate)
  if (rate.digits === 0n) {
    throw new RangeError('FX rate must be positive')
  }
  const exponentDelta =
    minorUnitExponent(input.baseCurrency).exponent - minorUnitExponent(input.currency).exponent
  // amount / (digits / 10^scale) × 10^delta  =  amount × 10^(scale + delta) / digits
  const numerator = amount * pow10(rate.scale + Math.max(0, exponentDelta))
  const denominator = rate.digits * pow10(Math.max(0, -exponentDelta))
  return divideHalfEven(numerator, denominator)
}
