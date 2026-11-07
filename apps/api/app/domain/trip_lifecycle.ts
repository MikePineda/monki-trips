/** Days a deleted trip stays restorable before the purge job removes it. */
export const TRIP_RESTORE_DAYS = 30

/** When a trip deleted at `now` is purged. */
export function tripPurgeDate(now: Date): Date {
  return new Date(now.getTime() + TRIP_RESTORE_DAYS * 24 * 60 * 60_000)
}
