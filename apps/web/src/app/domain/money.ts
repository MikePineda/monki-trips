import { minorUnitExponent } from '@monkitrips/shared'

/** The true minus sign the UI shows for negative amounts. */
export const MINUS = '−'

/**
 * Symbols that several currencies share (`$`, `¥`): when a trip mixes
 * currencies the base one is written with its usual prefix (`A$`, `US$`,
 * `JP¥`) so "$12" never reads as the wrong dollar. Currencies with a symbol
 * of their own (`€`, `฿`, `₩`) need no entry.
 */
const DISAMBIGUATED_SYMBOLS: Readonly<Record<string, string>> = {
  AUD: 'A$',
  USD: 'US$',
  NZD: 'NZ$',
  CAD: 'CA$',
  SGD: 'S$',
  HKD: 'HK$',
  MXN: 'MX$',
  TWD: 'NT$',
  ARS: 'AR$',
  CLP: 'CL$',
  COP: 'CO$',
  JPY: 'JP¥',
  CNY: 'CN¥',
}

export interface FormatMoneyOptions {
  /** The trip mixes currencies: a shared symbol gets its country prefix (`A$`). */
  disambiguate?: boolean
}

/**
 * Formats integer minor units as money for a locale: narrow symbol,
 * no decimals for currencies that customarily show none, the true minus
 * sign (U+2212) for negatives. Pure: `Intl` only, no implicit locale.
 */
export function formatMoney(
  amountMinor: number | bigint,
  currency: string,
  locale: string,
  options: FormatMoneyOptions = {}
): string {
  const { exponent } = minorUnitExponent(currency)
  const amount = Number(amountMinor) / 10 ** exponent
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).formatToParts(Math.abs(amount))
  const symbol = options.disambiguate ? DISAMBIGUATED_SYMBOLS[currency.toUpperCase()] : undefined
  const text = parts
    .map((part) => (part.type === 'currency' && symbol ? symbol : part.value))
    .join('')
  return amount < 0 ? `${MINUS}${text}` : text
}

/** True when the amounts of a trip are not all in one currency (the base symbol then needs a prefix). */
export function mixesCurrencies(baseCurrency: string, currencies: Iterable<string>): boolean {
  for (const currency of currencies) {
    if (currency.toUpperCase() !== baseCurrency.toUpperCase()) {
      return true
    }
  }
  return false
}

/**
 * Minor units of a decimal string typed on the keypad (`"12.5"` for a
 * 2-decimal currency is 1250; for a zero-decimal currency the fraction is
 * dropped). Empty or junk is null. Pure.
 */
export function keypadToMinor(digits: string, currency: string): number | null {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(digits.trim())
  if (!match) {
    return null
  }
  const { exponent } = minorUnitExponent(currency)
  const fraction = (match[2] ?? '').slice(0, exponent).padEnd(exponent, '0')
  const minor = Number(`${match[1]}${fraction}`)
  return Number.isSafeInteger(minor) ? minor : null
}

/** The keypad digits for stored minor units (`1250` in EUR is `"12.50"`), the inverse of `keypadToMinor`. */
export function minorToKeypad(amountMinor: number, currency: string): string {
  const { exponent } = minorUnitExponent(currency)
  const abs = Math.abs(amountMinor)
  if (exponent === 0) {
    return String(abs)
  }
  const text = String(abs).padStart(exponent + 1, '0')
  return `${text.slice(0, -exponent)}.${text.slice(-exponent)}`
}
