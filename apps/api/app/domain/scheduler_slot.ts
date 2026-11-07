/**
 * How often a scheduled job runs. Each interval cuts time into slots; a
 * slot runs at most once across every replica (`scheduler_runs` keeps one
 * row per job and slot).
 */
export type JobInterval = 'minute' | 'hour' | 'day'

/** The key of the slot `now` falls in: the UTC instant truncated to the interval, ISO-formatted. */
export function slotKey(interval: JobInterval, now: Date): string {
  const iso = now.toISOString()
  switch (interval) {
    case 'minute':
      return iso.slice(0, 16) + 'Z'
    case 'hour':
      return iso.slice(0, 13) + ':00Z'
    case 'day':
      return iso.slice(0, 10)
  }
}

/**
 * Whether this process runs the scheduler: only the HTTP server
 * (`environment: 'web'`) and only unless `SCHEDULER=off`. Ace commands,
 * the REPL and the test runner never start it.
 */
export function shouldStartScheduler(input: {
  scheduler: 'on' | 'off' | undefined
  environment: string
}): boolean {
  return input.scheduler !== 'off' && input.environment === 'web'
}
