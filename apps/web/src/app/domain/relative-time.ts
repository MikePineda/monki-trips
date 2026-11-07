/**
 * "3 min ago", "2 h ago", "yesterday", "on Wed 4 Nov" for an instant seen
 * from `now`, with days cut by the calendar of `timeZone` (the trip's
 * zone, so "yesterday" means the trip's yesterday). Pure: `Intl` only,
 * every input is a parameter.
 */
export interface RelativeTimeInput {
  /** ISO instant of the change. */
  instant: string
  /** ISO instant of "now". */
  now: string
  /** IANA zone the calendar days follow. */
  timeZone: string
  locale: string
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/** The calendar date (`YYYY-MM-DD`) of an instant in a zone. */
export function calendarDateIn(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Whole days between two calendar dates (`b` minus `a`). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

export function relativeTime(input: RelativeTimeInput): string {
  const then = Date.parse(input.instant)
  const now = Date.parse(input.now)
  if (Number.isNaN(then) || Number.isNaN(now)) {
    throw new TypeError('relativeTime needs two ISO instants')
  }
  const elapsed = Math.max(0, now - then)
  const relative = new Intl.RelativeTimeFormat(input.locale, { numeric: 'auto', style: 'short' })
  if (elapsed < MINUTE_MS) {
    return relative.format(0, 'second')
  }
  if (elapsed < HOUR_MS) {
    return relative.format(-Math.floor(elapsed / MINUTE_MS), 'minute')
  }
  const days = daysBetween(
    calendarDateIn(input.instant, input.timeZone),
    calendarDateIn(input.now, input.timeZone)
  )
  if (days === 0) {
    return relative.format(-Math.floor(elapsed / HOUR_MS), 'hour')
  }
  if (days < 7) {
    return relative.format(-days, 'day')
  }
  return new Intl.DateTimeFormat(input.locale, {
    timeZone: input.timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(then))
    .replace(/^(\S+),\s/, '$1 ')
}

/** The wall time of an instant in a zone, for the detail line ("14:03"). */
export function clockTimeIn(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant))
}
