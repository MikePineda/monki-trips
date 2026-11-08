/**
 * An amount as people say it ("350", "12.50") in a currency, turned into
 * integer minor units with the currency's ISO 4217 exponent. Exact or
 * nothing: more decimals than the currency has (a fraction of a yen) is
 * refused rather than rounded, and so is anything but a plain decimal.
 */
import { minorUnitExponent } from './currency_exponent.ts'
import { pow10 } from './minor_units.ts'

const PLAIN_DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/

export function majorAmountToMinor(amount: string, currency: string): bigint | null {
  const match = PLAIN_DECIMAL.exec(amount.trim())
  if (!match) return null
  const [, sign, whole, fraction = ''] = match
  const { exponent } = minorUnitExponent(currency)
  if (fraction.length > exponent) return null
  const minor = BigInt(whole) * pow10(exponent) + BigInt(fraction.padEnd(exponent, '0') || '0')
  return sign ? -minor : minor
}
