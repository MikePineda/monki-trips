import { DateTime, IANAZone } from 'luxon'

/** `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`, no zone: what the client sends and the database stores. */
const LOCAL_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

export type LocalTimeResult =
  | {
      ok: true
      /** The instant, ISO in UTC. */
      at: string
      /** The local date (`YYYY-MM-DD`), the day the event belongs to. */
      on: string
      /** The local time normalised to seconds (`YYYY-MM-DDTHH:mm:ss`). */
      local: string
    }
  | { ok: false; reason: 'invalid_format' | 'invalid_zone' | 'nonexistent' }

/** Whether `zone` is an IANA time zone this runtime knows. */
export function isValidZone(zone: string): boolean {
  return IANAZone.isValidZone(zone)
}

/**
 * The instant a local wall-clock time in an IANA zone names. Two rules for
 * daylight-saving transitions, decided by the plan: a time that does not
 * exist (the clocks jumped over it) is an error, never shifted silently;
 * a time that exists twice (the clocks went back) is the earlier instant,
 * the first time the clock showed it. Pure: no "now", no I/O.
 */
export function localTimeToInstant(local: string, zone: string): LocalTimeResult {
  const match = LOCAL_TIME.exec(local)
  if (!match) return { ok: false, reason: 'invalid_format' }
  if (!isValidZone(zone)) return { ok: false, reason: 'invalid_zone' }
  const [, day, hh, mm, ss = '00'] = match
  const normalized = `${day}T${hh}:${mm}:${ss}`
  const naive = DateTime.fromISO(normalized, { zone: 'utc' })
  if (!naive.isValid) return { ok: false, reason: 'invalid_format' }

  const tz = IANAZone.create(zone)
  const wallMs = naive.toMillis()
  // The instant lies within 15 hours of the wall time read as UTC (offsets
  // span -12 to +14). Sampling the zone's offset at both ends of that range
  // and in the middle sees every offset that can be in force at the instant,
  // because no zone has two transitions within thirty hours.
  const window = 15 * 60 * 60 * 1000
  const candidateOffsets = new Set([
    tz.offset(wallMs - window),
    tz.offset(wallMs),
    tz.offset(wallMs + window),
  ])
  const instants: number[] = []
  for (const offsetMinutes of candidateOffsets) {
    const instant = wallMs - offsetMinutes * 60_000
    if (tz.offset(instant) === offsetMinutes) instants.push(instant)
  }
  if (instants.length === 0) return { ok: false, reason: 'nonexistent' }
  const earliest = Math.min(...instants)
  return {
    ok: true,
    at: new Date(earliest).toISOString(),
    on: day,
    local: normalized,
  }
}
