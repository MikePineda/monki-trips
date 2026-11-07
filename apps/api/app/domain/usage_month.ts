/**
 * The UTC month an instant belongs to, for the monthly LLM cap: its first
 * instant, the first instant of the next month and the day the cap resets
 * (`YYYY-MM-DD`). Pure: `now` is always a parameter.
 */
export interface UsageMonth {
  /** `YYYY-MM`. */
  key: string
  startsAt: Date
  endsAt: Date
  resetsOn: string
}

export function usageMonthOf(now: Date): UsageMonth {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const startsAt = new Date(Date.UTC(year, month, 1))
  const endsAt = new Date(Date.UTC(year, month + 1, 1))
  return {
    key: startsAt.toISOString().slice(0, 7),
    startsAt,
    endsAt,
    resetsOn: endsAt.toISOString().slice(0, 10),
  }
}

/** The month named `YYYY-MM`, or null when the text is not one. */
export function usageMonthFromKey(key: string): UsageMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return usageMonthOf(new Date(Date.UTC(Number(match[1]), month - 1, 1)))
}

/** Tokens left under `cap` after `used`, never negative. */
export function tokensLeft(cap: number, used: number): number {
  return Math.max(0, cap - used)
}
