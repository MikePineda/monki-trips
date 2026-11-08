/**
 * Trip expenses CSV v1 (docs/CONTRACTS.md): one record per live expense of
 * a trip, settlements included and marked, for spreadsheets and
 * personal-finance apps. RFC 4180 (comma, CRLF, double quotes doubled),
 * UTF-8 with a BOM so spreadsheet apps read accents right. Amounts are
 * decimal strings built from integer minor units with the ISO 4217
 * exponent of their currency, never through a float. Text cells that a
 * spreadsheet would run as a formula (starting with `=`, `+`, `-`, `@`, a
 * tab or a carriage return) get a leading `'`; the numeric columns are
 * written by this module and never escaped, so a refund keeps its minus.
 * Pure: rows in, text out.
 */
import { minorUnitExponent, toMinor, type ExpenseKind, type MinorUnits } from '@monkitrips/shared'

/** The header of v1, in order. A new column is a v2. */
export const EXPENSES_CSV_COLUMNS = [
  'date',
  'description',
  'category',
  'amount',
  'currency',
  'base_amount',
  'base_currency',
  'fx_rate',
  'paid_by',
  'split_with',
  'kind',
  'trip',
] as const

/** Separator between names in `split_with`. */
export const SPLIT_WITH_SEPARATOR = '; '

const BOM = '\uFEFF'
const CRLF = '\r\n'
const FORMULA_START = /^[=+\-@\t\r]/
const NEEDS_QUOTES = /[",\r\n]/

export interface CsvExpense {
  spentOn: string
  description: string | null
  /** The category key of a default line (`food`) or the custom name. */
  category: string | null
  amountMinor: MinorUnits
  currency: string
  /** Null while the expense waits for a rate: the base columns stay empty. */
  baseAmountMinor: MinorUnits | null
  baseCurrency: string
  fxRate: string | null
  paidBy: string | null
  splitWith: readonly string[]
  kind: ExpenseKind
  trip: string
}

/** `4250` EUR → `42.50`, `1200` JPY → `1200`, `-5` EUR → `-0.05`. */
export function decimalFromMinor(amount: MinorUnits, currency: string): string {
  const minor = toMinor(amount)
  const { exponent } = minorUnitExponent(currency)
  const negative = minor < 0n
  const digits = (negative ? -minor : minor).toString().padStart(exponent + 1, '0')
  const whole = digits.slice(0, digits.length - exponent)
  const fraction = exponent > 0 ? `.${digits.slice(digits.length - exponent)}` : ''
  return `${negative ? '-' : ''}${whole}${fraction}`
}

/** A stored rate (`161.0700000000`) without the padding zeros (`161.07`). */
export function plainRate(rate: string): string {
  const trimmed = rate.trim()
  if (!trimmed.includes('.')) {
    return trimmed
  }
  return trimmed.replace(/0+$/, '').replace(/\.$/, '')
}

/** One text cell: formula-safe, then quoted when RFC 4180 needs it. */
export function csvCell(value: string | null): string {
  if (value === null || value === '') {
    return ''
  }
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function record(expense: CsvExpense): string {
  const pending = expense.baseAmountMinor === null
  const cells = [
    csvCell(expense.spentOn),
    csvCell(expense.description),
    csvCell(expense.category),
    decimalFromMinor(expense.amountMinor, expense.currency),
    csvCell(expense.currency),
    pending ? '' : decimalFromMinor(expense.baseAmountMinor!, expense.baseCurrency),
    pending ? '' : csvCell(expense.baseCurrency),
    pending || expense.fxRate === null ? '' : plainRate(expense.fxRate),
    csvCell(expense.paidBy),
    csvCell(expense.splitWith.join(SPLIT_WITH_SEPARATOR)),
    csvCell(expense.kind),
    csvCell(expense.trip),
  ]
  return cells.join(',')
}

/** The whole file: BOM, header, one CRLF-terminated record per expense in the order given. */
export function expensesCsv(expenses: readonly CsvExpense[]): string {
  return (
    BOM +
    [EXPENSES_CSV_COLUMNS.join(','), ...expenses.map(record)].map((line) => line + CRLF).join('')
  )
}

/** `trip-<slug>-expenses-<date>.csv`, from the JSON export's file name rules. */
export function expensesCsvFileName(jsonFileName: string): string {
  return jsonFileName.replace(/-(\d{4}-\d{2}-\d{2})\.json$/, '-expenses-$1.csv')
}
