import type { ReceiptDraft } from '@monkitrips/shared'
import { keypadToMinor, minorToKeypad } from '../../domain/money'

/** What a read receipt sets in the quick expense sheet; null leaves the sheet's own value. */
export interface ReceiptFill {
  /** Keypad digits in the receipt's (or the sheet's) currency. */
  digits: string | null
  currency: string | null
  spentOn: string | null
  categoryId: string | null
}

const DECIMAL = /^\d+(?:\.\d+)?$/
const CURRENCY = /^[A-Za-z]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Maps a receipt draft onto the quick expense: the amount as keypad
 * digits (in the receipt's currency when it gave one, else `currency`),
 * the date, and the category whose default key matches. A negative amount
 * (a refund) is not a quick expense and is left for the member. Pure.
 */
export function receiptFill(
  draft: ReceiptDraft,
  categories: readonly { id: string; key: string | null }[],
  currency: string
): ReceiptFill {
  const code = draft.currency && CURRENCY.test(draft.currency) ? draft.currency.toUpperCase() : null
  const amount = draft.amount?.trim() ?? ''
  const minor = DECIMAL.test(amount) ? keypadToMinor(amount, code ?? currency) : null
  return {
    digits: minor === null ? null : minorToKeypad(minor, code ?? currency),
    currency: code,
    spentOn: draft.spentOn && DATE.test(draft.spentOn) ? draft.spentOn : null,
    categoryId: draft.categoryKey
      ? (categories.find((category) => category.key === draft.categoryKey)?.id ?? null)
      : null,
  }
}
