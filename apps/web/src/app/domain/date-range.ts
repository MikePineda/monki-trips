import { formatDayDate } from './day-date'

/**
 * A trip's dates for people, from two `YYYY-MM-DD` strings: "27 Oct – 5 Nov
 * 2026", the month once when it does not change ("3 – 9 Nov 2026"), both
 * years across New Year ("28 Dec 2026 – 3 Jan 2027"), one date for a day
 * trip. Built on `formatDayDate`, so it follows the app's locale; never the
 * raw ISO dates. Pure.
 */
export function formatDateRange(startsOn: string, endsOn: string, locale: string): string {
  const [startYear, startMonth] = startsOn.split('-')
  const [endYear, endMonth] = endsOn.split('-')
  const end = `${formatDayDate(endsOn, locale, false)} ${endYear}`
  if (startsOn === endsOn) {
    return end
  }
  if (startYear !== endYear) {
    return `${formatDayDate(startsOn, locale, false)} ${startYear} – ${end}`
  }
  if (startMonth === endMonth) {
    return `${Number(startsOn.slice(8, 10))} – ${end}`
  }
  return `${formatDayDate(startsOn, locale, false)} – ${end}`
}
