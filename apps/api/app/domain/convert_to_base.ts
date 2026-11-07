/**
 * Converts an amount in a foreign currency to the trip's base currency, in
 * integer minor units. `rate` is units of the foreign currency per 1 base
 * unit (the provider's `base=<trip base>` format) as a decimal string, so
 * `base = amount / rate`, adjusted for the two currencies' minor-unit
 * exponents and rounded half-even. BigInt throughout: no floating point
 * touches money. Mirrors the shared `convert_to_base`.
 */

export interface ConvertToBaseInput {
  /** Amount in the foreign currency's minor units (negative = refund). */
  amountMinor: bigint | number
  /** Units of the foreign currency per 1 base unit, e.g. "22.3456789012". */
  rate: string
  /** Minor-unit exponent of the foreign currency (JPY 0, THB 2). */
  fromExponent: number
  /** Minor-unit exponent of the base currency. */
  toExponent: number
}

const RATE = /^(\d+)(?:\.(\d+))?$/

/** Parses a positive decimal string into an integer and the number of decimals it carries. */
export function parseDecimal(value: string): { digits: bigint; scale: number } {
  const match = RATE.exec(value.trim())
  if (!match) throw new Error('rate must be a positive decimal string')
  const [, whole, fraction = ''] = match
  const digits = BigInt(whole + fraction)
  if (digits === 0n) throw new Error('rate must be greater than zero')
  return { digits, scale: fraction.length }
}

/** Integer division rounded half to even (banker's rounding); `divisor` must be positive. */
export function divideHalfEven(dividend: bigint, divisor: bigint): bigint {
  const negative = dividend < 0n
  const n = negative ? -dividend : dividend
  let quotient = n / divisor
  const remainder = n % divisor
  const twice = remainder * 2n
  if (twice > divisor || (twice === divisor && quotient % 2n === 1n)) {
    quotient += 1n
  }
  return negative ? -quotient : quotient
}

export function convertToBaseMinor(input: ConvertToBaseInput): bigint {
  const { digits, scale } = parseDecimal(input.rate)
  const amount = BigInt(input.amountMinor)
  const exponentShift = input.toExponent - input.fromExponent
  // base = amount * 10^scale * 10^shift / digits
  let numerator = amount * 10n ** BigInt(scale)
  let denominator = digits
  if (exponentShift >= 0) {
    numerator *= 10n ** BigInt(exponentShift)
  } else {
    denominator *= 10n ** BigInt(-exponentShift)
  }
  return divideHalfEven(numerator, denominator)
}
