/**
 * Calendar dates as `YYYY-MM-DD` strings, the only date shape the domain
 * accepts. Arithmetic runs on whole days through `Date.UTC`, so there is no
 * zone, no DST and no implicit "now" anywhere in here.
 */

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

export interface IsoDateParts {
  year: number
  month: number
  day: number
}

/** True for a well-formed, existing calendar date (`2026-02-30` is false). */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (!match) {
    return false
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/** Splits a date into its parts; throws `RangeError` on anything that is not a real date. */
export function parseIsoDate(value: string): IsoDateParts {
  if (!isIsoDate(value)) {
    throw new RangeError(`Invalid ISO date: ${JSON.stringify(value)}`)
  }
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
  }
}

/** Whole days since 1970-01-01. */
export function isoDateToEpochDays(value: IsoDate): number {
  const { year, month, day } = parseIsoDate(value)
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

/** The inverse of `isoDateToEpochDays`. */
export function epochDaysToIsoDate(days: number): IsoDate {
  return new Date(days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** `value` shifted by `days` (negative goes back). */
export function addDays(value: IsoDate, days: number): IsoDate {
  return epochDaysToIsoDate(isoDateToEpochDays(value) + days)
}

/** Signed number of days from `from` to `to` (`to − from`). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return isoDateToEpochDays(to) - isoDateToEpochDays(from)
}

/** Lexicographic order is chronological for valid ISO dates. */
export function compareIsoDate(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  if (a === b) {
    return 0
  }
  return a < b ? -1 : 1
}

/** Every date from `from` (inclusive) to `toExclusive`; empty when the range is empty or reversed. */
export function isoDateRange(from: IsoDate, toExclusive: IsoDate): IsoDate[] {
  const count = daysBetween(from, toExclusive)
  const dates: IsoDate[] = []
  for (let i = 0; i < count; i++) {
    dates.push(addDays(from, i))
  }
  return dates
}
