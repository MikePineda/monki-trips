/**
 * The calendar date (`YYYY-MM-DD`) an instant falls on in a time zone, the
 * "today" the task urgency groups count from. `Intl` only; the instant and
 * the zone are always passed in (no implicit `now`, no device zone).
 */
export function localToday(instant: string, timeZone: string): string {
  const ms = Date.parse(instant)
  if (Number.isNaN(ms)) {
    throw new TypeError(`not an ISO instant: ${instant}`)
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms))
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
