/**
 * The month of a `YYYY-MM-DD` date with its year, for people ("Oct 2026",
 * "oct 2026"): the map's trip list and the history of trips long past.
 * Pure: `Intl` only, the calendar date as written, the locale passed in.
 */
export function formatMonthYear(isoDate: string, locale: string): string {
  const [year, month] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}
