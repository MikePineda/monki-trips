import { calendarDateIn, clockTimeIn } from './relative-time'

/**
 * When an upcoming reminder fires, as Settings lists it: "Today 18:05",
 * "Tomorrow 08:00" ("Mañana 08:00"), the day counted on the calendar of
 * `timeZone` (the device's) and the clock in 24 h. Pure: `Intl` only, every
 * input is a parameter.
 */
export interface ReminderFireTimeInput {
  /** ISO instant the reminder fires at. */
  instant: string
  /** ISO instant of "now". */
  now: string
  /** IANA zone the day and the clock follow. */
  timeZone: string
  locale: string
}

const DAY_MS = 86_400_000

export function reminderFireTime(input: ReminderFireTimeInput): string {
  const today = calendarDateIn(input.now, input.timeZone)
  const day = calendarDateIn(input.instant, input.timeZone)
  const days = Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS
  )
  const dayWord = new Intl.RelativeTimeFormat(input.locale, { numeric: 'auto' }).format(days, 'day')
  const capitalised = dayWord.charAt(0).toLocaleUpperCase(input.locale) + dayWord.slice(1)
  return `${capitalised} ${clockTimeIn(input.instant, input.timeZone, input.locale)}`
}
