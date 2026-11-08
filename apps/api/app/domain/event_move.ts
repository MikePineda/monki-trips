import { DateTime } from 'luxon'

/** `YYYY-MM-DDTHH:mm[:ss]`, no zone. */
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/

function wallClock(local: string): DateTime | null {
  if (!LOCAL_TIME.test(local)) return null
  const parsed = DateTime.fromISO(local, { zone: 'utc' })
  return parsed.isValid ? parsed : null
}

/**
 * Where an event's end lands when its start moves to `newStart` and the
 * end was not given: the same wall-clock duration after the new start, as
 * a local time (`YYYY-MM-DDTHH:mm:ss`). Null when the event has no start
 * or no end to keep the duration of, or a value is not a local time. Pure:
 * the zones stay as they are, the server derives the instants on write.
 */
export function shiftedEnd(
  oldStart: string | null,
  oldEnd: string | null,
  newStart: string
): string | null {
  if (!oldStart || !oldEnd) return null
  const from = wallClock(oldStart)
  const to = wallClock(oldEnd)
  const start = wallClock(newStart)
  if (!from || !to || !start) return null
  return start.plus(to.diff(from)).toFormat("yyyy-LL-dd'T'HH:mm:ss")
}
