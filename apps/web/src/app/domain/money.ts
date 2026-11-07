import { minorUnitExponent } from '@monkitrips/shared'

/** The true minus sign the UI shows for negative amounts. */
export const MINUS = '−'

/**
 * Formats integer minor units as money for a locale: narrow symbol,
 * no decimals for currencies that customarily show none, the true minus
 * sign (U+2212) for negatives. Pure: `Intl` only, no implicit locale.
 */
export function formatMoney(amountMinor: number, currency: string, locale: string): string {
  const { exponent } = minorUnitExponent(currency)
  const amount = amountMinor / 10 ** exponent
  const text = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(Math.abs(amount))
  return amount < 0 ? `${MINUS}${text}` : text
}
