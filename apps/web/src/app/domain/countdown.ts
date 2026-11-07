/**
 * The countdown on the ticket, as the parts the copy needs: whole days,
 * hours and minutes left, rounded down; `soon` under a minute. Pure.
 */
export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  soon: boolean
}

const MINUTE_MS = 60_000

export function countdownParts(ms: number): CountdownParts {
  const totalMinutes = Math.max(0, Math.floor(ms / MINUTE_MS))
  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor(totalMinutes / 60) % 24,
    minutes: totalMinutes % 60,
    soon: totalMinutes === 0,
  }
}

/** The catalogue key of a countdown: the coarsest unit that is not zero leads. */
export function countdownKey(parts: CountdownParts): 'soon' | 'days' | 'hours' | 'minutes' {
  if (parts.soon) {
    return 'soon'
  }
  if (parts.days > 0) {
    return 'days'
  }
  return parts.hours > 0 ? 'hours' : 'minutes'
}
