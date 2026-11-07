/**
 * An instant together with the UTC offset its IANA zone had at that instant.
 *
 * Input contract: the domain never resolves time zones itself (no Luxon, no
 * `Intl`). The caller (the API with Luxon, the web app with `Intl`) resolves
 * `tz` at the instant and passes `offsetMin`, minutes east of UTC. That is
 * enough to recover the local wall clock, and it settles DST by construction:
 *   - a local time inside a DST gap does not exist and never reaches the
 *     domain (the API answers 422);
 *   - an ambiguous local time (DST overlap) is disambiguated by the offset
 *     the caller chose, so the two candidates are two different instants.
 */
import type { IsoDate } from './iso_date.ts'

/** An ISO 8601 instant with an explicit zone designator, normally UTC (`...Z`). */
export type IsoInstant = string

/** A local wall-clock time without zone, `YYYY-MM-DDTHH:mm` (seconds optional on input). */
export type IsoLocalDateTime = string

export interface ZonedInstant {
  at: IsoInstant
  /** UTC offset of `tz` at `at`, in minutes east of UTC (e.g. `-300`, `540`, `345`). */
  offsetMin: number
  /** IANA zone name, carried for display; the domain never interprets it. */
  tz?: string
}

const MS_PER_MINUTE = 60_000
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/

/** Epoch milliseconds of an instant; throws `RangeError` when the string is not a date. */
export function epochMs(at: IsoInstant): number {
  const ms = Date.parse(at)
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ISO instant: ${JSON.stringify(at)}`)
  }
  return ms
}

/** Epoch milliseconds of the wall clock a zoned instant shows (UTC parts of the shifted instant). */
function shiftedMs(zoned: ZonedInstant): number {
  return epochMs(zoned.at) + zoned.offsetMin * MS_PER_MINUTE
}

/** The local wall clock of a zoned instant, `YYYY-MM-DDTHH:mm`. */
export function localDateTime(zoned: ZonedInstant): IsoLocalDateTime {
  return new Date(shiftedMs(zoned)).toISOString().slice(0, 16)
}

/** The local calendar date of a zoned instant. */
export function localDate(zoned: ZonedInstant): IsoDate {
  return localDateTime(zoned).slice(0, 10)
}

/** Minutes since local midnight of a zoned instant (0..1439). */
export function localMinutesOfDay(zoned: ZonedInstant): number {
  const date = new Date(shiftedMs(zoned))
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

/** Epoch milliseconds of a wall-clock time read with the given offset. */
export function instantOfLocalMs(local: IsoLocalDateTime, offsetMin: number): number {
  const match = LOCAL_DATE_TIME.exec(local)
  if (!match) {
    throw new RangeError(`Invalid local date-time: ${JSON.stringify(local)}`)
  }
  const dayMs = Date.parse(`${match[1]}T00:00:00Z`)
  if (Number.isNaN(dayMs)) {
    throw new RangeError(`Invalid local date-time: ${JSON.stringify(local)}`)
  }
  const minutes = Number(match[2]) * 60 + Number(match[3])
  const seconds = match[4] ? Number(match[4]) : 0
  return dayMs + minutes * MS_PER_MINUTE + seconds * 1000 - offsetMin * MS_PER_MINUTE
}

/** The UTC instant of a wall-clock time read with the given offset. */
export function instantOfLocal(local: IsoLocalDateTime, offsetMin: number): IsoInstant {
  return new Date(instantOfLocalMs(local, offsetMin)).toISOString()
}

/** Builds a zoned instant from a wall clock and its offset (the inverse of `localDateTime`). */
export function zonedFromLocal(
  local: IsoLocalDateTime,
  offsetMin: number,
  tz?: string
): ZonedInstant {
  return { at: instantOfLocal(local, offsetMin), offsetMin, tz }
}
