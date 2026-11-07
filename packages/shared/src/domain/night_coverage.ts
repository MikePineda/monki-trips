/**
 * Where do we sleep each night? A night is named after the day it starts:
 * the trip has one per day from `startsOn` to `endsOn − 1` (a one-day trip
 * has none). Night D is covered by
 *   - a `lodging` whose local check-in date ≤ D < local check-out date, or
 *   - a transport (or, when it has segments, one of its segments) whose
 *     window covers 01:00–05:00 of D+1 read in the departure zone:
 *     `departs ≤ D+1 01:00` and `arrives ≥ D+1 05:00`, or
 *   - any event with `coversNight: true` (the nights from its local start
 *     date to the eve of its local end date, at least the start date).
 * `coversNight: false` forbids coverage; `cancelled` and `idea` events never
 * cover. An event without an end has no window: a lodging without a
 * check-out covers only its check-in night, a transport without an arrival
 * covers nothing. A layover between two segments is not a night on board.
 */
import { addDays, compareIsoDate, type IsoDate } from './iso_date.ts'
import { tripNightDates, type TripDates } from './trip_dates.ts'
import {
  isActiveEvent,
  isTransportKind,
  sortedSegments,
  type EventKind,
  type TripEvent,
} from './trip_event.ts'
import { epochMs, instantOfLocalMs, localDate, type ZonedInstant } from './zoned_instant.ts'

export type NightCoverKind = 'lodging' | 'transport' | 'override'

export interface NightCover {
  eventId: string
  kind: EventKind
  how: NightCoverKind
  /** The segment that covers the night, when the event has segments. */
  segmentId?: string
}

/** A cover tied to the night it covers; what `nightsCoveredBy` yields. */
export interface NightCoverOnNight extends NightCover {
  night: IsoDate
}

export interface NightCoverage {
  date: IsoDate
  covered: boolean
  /** Every event that covers the night; a hotel and a train on the same night both appear, the night counts once. */
  coveredBy: NightCover[]
}

export interface NightCoverageReport {
  nights: NightCoverage[]
  coveredCount: number
  /** Nights with nowhere to sleep: these raise the alert. */
  uncovered: IsoDate[]
}

/** Local time of day, in the departure zone, by which a transport must have left to count as a night on board. */
export const NIGHT_WINDOW_START = 'T01:00'

/** Local time of day, in the departure zone, until which a transport must still be moving. */
export const NIGHT_WINDOW_END = 'T05:00'

interface TransportWindow {
  departs: ZonedInstant
  arrives: ZonedInstant
  segmentId?: string
}

/** True when a transport window covers 01:00–05:00 of the night after `night`, read in the departure zone. */
export function windowCoversNight(window: TransportWindow, night: IsoDate): boolean {
  const next = addDays(night, 1)
  const offset = window.departs.offsetMin
  const windowStart = instantOfLocalMs(`${next}${NIGHT_WINDOW_START}`, offset)
  const windowEnd = instantOfLocalMs(`${next}${NIGHT_WINDOW_END}`, offset)
  return epochMs(window.departs.at) <= windowStart && epochMs(window.arrives.at) >= windowEnd
}

function transportWindows(event: TripEvent): TransportWindow[] {
  const segments = sortedSegments(event)
  if (segments.length > 0) {
    return segments.flatMap((segment) =>
      segment.arrives
        ? [{ departs: segment.departs, arrives: segment.arrives, segmentId: segment.id }]
        : []
    )
  }
  return event.ends ? [{ departs: event.starts, arrives: event.ends }] : []
}

/** Nights from the local start date to the eve of the local end date, at least the start date. */
function spannedNights(event: TripEvent): IsoDate[] {
  const first = localDate(event.starts)
  const last = event.ends ? addDays(localDate(event.ends), -1) : first
  const nights: IsoDate[] = [first]
  for (let night = addDays(first, 1); compareIsoDate(night, last) <= 0; night = addDays(night, 1)) {
    nights.push(night)
  }
  return nights
}

/** The nights one event covers, among the given candidates. */
export function nightsCoveredBy(event: TripEvent, nights: readonly IsoDate[]): NightCoverOnNight[] {
  if (!isActiveEvent(event) || event.coversNight === false) {
    return []
  }
  const base = { eventId: event.id, kind: event.kind }
  if (event.coversNight === true) {
    const spanned = new Set(spannedNights(event))
    return nights
      .filter((night) => spanned.has(night))
      .map((night) => ({ ...base, how: 'override' as const, night }))
  }
  if (event.kind === 'lodging') {
    const checkIn = localDate(event.starts)
    const checkOut = event.ends ? localDate(event.ends) : addDays(checkIn, 1)
    return nights
      .filter((night) => compareIsoDate(checkIn, night) <= 0 && compareIsoDate(night, checkOut) < 0)
      .map((night) => ({ ...base, how: 'lodging' as const, night }))
  }
  if (isTransportKind(event.kind)) {
    const covers: NightCoverOnNight[] = []
    for (const window of transportWindows(event)) {
      for (const night of nights) {
        if (windowCoversNight(window, night)) {
          covers.push({ ...base, how: 'transport', segmentId: window.segmentId, night })
        }
      }
    }
    return covers
  }
  return []
}

/** Coverage of every night of the trip. */
export function nightCoverage(trip: TripDates, events: readonly TripEvent[]): NightCoverageReport {
  const dates = tripNightDates(trip)
  const byNight = new Map<IsoDate, NightCover[]>(dates.map((date) => [date, []]))
  for (const event of events) {
    for (const { night, ...rest } of nightsCoveredBy(event, dates)) {
      byNight.get(night)?.push(rest)
    }
  }
  const nights = dates.map((date) => {
    const coveredBy = byNight.get(date) ?? []
    return { date, covered: coveredBy.length > 0, coveredBy }
  })
  return {
    nights,
    coveredCount: nights.filter((night) => night.covered).length,
    uncovered: nights.filter((night) => !night.covered).map((night) => night.date),
  }
}

/** True when an active transport event is a night on board for at least one of the given nights. */
export function isNightTransport(event: TripEvent, nights: readonly IsoDate[]): boolean {
  if (!isTransportKind(event.kind)) {
    return false
  }
  return nightsCoveredBy(event, nights).length > 0
}
