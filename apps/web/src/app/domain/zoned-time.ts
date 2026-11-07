import { instantOfLocalMs, type IsoInstant, type ZonedInstant } from '@monkitrips/shared'

/**
 * Time zones on the device, with `Intl` only (no Luxon in the web app).
 * Pure: the zone, the instant and the locale are always passed in; nothing
 * here reads the device clock or its zone.
 */

/** `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`, no zone. */
const LOCAL_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

const MS_PER_MINUTE = 60_000
/** Offsets span −12 to +14 h: the instant lies within 15 h of the wall time read as UTC. */
const OFFSET_WINDOW_MS = 15 * 60 * MS_PER_MINUTE

const formatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(zone, formatter)
  }
  return formatter
}

/** True when the runtime knows the IANA zone. */
export function isKnownZone(zone: string): boolean {
  try {
    partsFormatter(zone)
    return true
  } catch {
    return false
  }
}

/** The UTC offset of `zone` at `atMs`, in minutes east of UTC. Throws `RangeError` on an unknown zone. */
export function zoneOffsetMinutes(zone: string, atMs: number): number {
  const parts = partsFormatter(zone).formatToParts(new Date(atMs))
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  // The wall clock the zone shows, read as if it were UTC, minus the instant.
  const wallMs = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour') % 24,
    read('minute'),
    read('second')
  )
  return Math.round((wallMs - atMs) / MS_PER_MINUTE)
}

/**
 * The instant a local wall-clock time in an IANA zone names, with the API's
 * rules for daylight-saving transitions: a time the clocks jumped over does
 * not exist (null), a time that exists twice is the earlier instant. Null
 * also for a malformed time or an unknown zone.
 */
export function localToInstant(local: string, zone: string): IsoInstant | null {
  const match = LOCAL_TIME.exec(local)
  if (!match || !isKnownZone(zone)) {
    return null
  }
  let wallMs: number
  try {
    wallMs = instantOfLocalMs(local, 0)
  } catch {
    return null
  }
  const candidates = new Set([
    zoneOffsetMinutes(zone, wallMs - OFFSET_WINDOW_MS),
    zoneOffsetMinutes(zone, wallMs),
    zoneOffsetMinutes(zone, wallMs + OFFSET_WINDOW_MS),
  ])
  const instants: number[] = []
  for (const offset of candidates) {
    const instant = wallMs - offset * MS_PER_MINUTE
    if (zoneOffsetMinutes(zone, instant) === offset) {
      instants.push(instant)
    }
  }
  if (instants.length === 0) {
    return null
  }
  return new Date(Math.min(...instants)).toISOString()
}

/** A domain `ZonedInstant` for an instant read in `zone`. */
export function zonedInstant(at: IsoInstant, zone: string): ZonedInstant {
  return { at, offsetMin: zoneOffsetMinutes(zone, Date.parse(at)), tz: zone }
}

/** The `HH:mm` part of a local wall-clock time. */
export function localClock(local: string): string {
  const match = LOCAL_TIME.exec(local)
  return match ? `${match[2]}:${match[3]}` : local
}

/** The `YYYY-MM-DD` part of a local wall-clock time. */
export function localDateOf(local: string): string {
  return local.slice(0, 10)
}

/** The zone's short name at an instant for a locale (`EEST`, `GMT+7`, `AEDT`). */
export function zoneAbbreviation(zone: string, atMs: number, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    timeZoneName: 'short',
  }).formatToParts(new Date(atMs))
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? zone
}

/**
 * The zone abbreviation to show next to a local time: only when the
 * place's offset differs from the device's at that instant, else null.
 */
export function zoneLabel(
  zone: string,
  atMs: number,
  deviceZone: string,
  locale: string
): string | null {
  if (!isKnownZone(zone) || !isKnownZone(deviceZone)) {
    return null
  }
  if (zoneOffsetMinutes(zone, atMs) === zoneOffsetMinutes(deviceZone, atMs)) {
    return null
  }
  return zoneAbbreviation(zone, atMs, locale)
}

/** Every IANA zone the runtime offers, plus `value` when it is not among them. */
export function zoneOptions(value?: string | null): string[] {
  const known: string[] =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  if (value && !known.includes(value)) {
    return [value, ...known]
  }
  return known
}
