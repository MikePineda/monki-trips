/**
 * Integer money. Amounts are minor units (`*Minor`) and the domain computes
 * with `bigint` so sums never lose precision. Inputs may arrive as `bigint`,
 * as a decimal string (what JSON carries, `bigint` does not serialise) or as
 * a safe-integer `number` (the current wire types); outputs are always
 * `bigint`.
 */

/** A minor-unit amount as the caller holds it. */
export type MinorUnits = bigint | number | string

const INTEGER_STRING = /^[+-]?\d+$/

/** Normalises an amount to `bigint`; throws `RangeError` on fractions, unsafe numbers or junk. */
export function toMinor(value: MinorUnits): bigint {
  if (typeof value === 'bigint') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`Minor units must be a safe integer, got ${value}`)
    }
    return BigInt(value)
  }
  const trimmed = value.trim()
  if (!INTEGER_STRING.test(trimmed)) {
    throw new RangeError(`Minor units must be an integer string, got ${JSON.stringify(value)}`)
  }
  return BigInt(trimmed)
}

/** Sums amounts of mixed shapes. */
export function sumMinor(values: Iterable<MinorUnits>): bigint {
  let total = 0n
  for (const value of values) {
    total += toMinor(value)
  }
  return total
}

/** Integer division rounded toward negative infinity (`-7 / 2 = -4`), what "per day" allowances need. */
export function floorDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError('Division by zero')
  }
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  const negative = remainder < 0n !== denominator < 0n
  return remainder !== 0n && negative ? quotient - 1n : quotient
}

/**
 * Integer division rounded half to even (banker's rounding), symmetric for
 * negative amounts: `25 / 2 = 12`, `35 / 2 = 18`, `-25 / 2 = -12`.
 */
export function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError('Division by zero')
  }
  const negative = numerator < 0n !== denominator < 0n
  const absNum = numerator < 0n ? -numerator : numerator
  const absDen = denominator < 0n ? -denominator : denominator
  let quotient = absNum / absDen
  const remainder = absNum % absDen
  const twice = remainder * 2n
  if (twice > absDen || (twice === absDen && quotient % 2n === 1n)) {
    quotient += 1n
  }
  return negative ? -quotient : quotient
}

/** `10^exponent` as a bigint. */
export function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new RangeError(`Exponent must be a non-negative integer, got ${exponent}`)
  }
  return 10n ** BigInt(exponent)
}
