/**
 * Day-first calendar dates for the UI ("Wed 12 May", "mié 12 may") from a
 * `YYYY-MM-DD` string. Pure: `Intl` only, the calendar date is taken as
 * written (no zone shift), the locale is always passed in.
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDayDate(isoDate: string, locale: string, withWeekday = true): string {
  const match = ISO_DATE.exec(isoDate)
  if (!match) {
    throw new TypeError(`not a YYYY-MM-DD date: ${isoDate}`)
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  const text = new Intl.DateTimeFormat(locale, {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date)
  // "Wed, 12 May" reads as "Wed 12 May" in the design (no comma after the weekday).
  return text.replace(/^(\S+),\s/, '$1 ')
}
