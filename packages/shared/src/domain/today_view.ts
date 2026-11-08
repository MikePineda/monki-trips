/**
 * The Today screen, computed once from the trip's data and `now`, the same
 * on the server (`GET /trips/:tripId/today?at=`) and offline on the device.
 *
 * Today's date is read in the zone of the stop that covers `now`; failing
 * that, in the zone of the last event that has started (its arrival zone
 * once it has ended); failing that, in the trip's home zone. The caller
 * resolves each zone's offset at `now` (`offsetMin` on stops and on the
 * trip) and at every event instant.
 */
import { addDays, type IsoDate } from './iso_date.ts'
import { budgetStatus, type BudgetExpense, type BudgetStatus } from './budget_status.ts'
import { leaveAtMs, leaveBufferMin } from './leave_at.ts'
import type { MinorUnits } from './minor_units.ts'
import { nightsCoveredBy, type NightCoverOnNight } from './night_coverage.ts'
import {
  isTripNight,
  tripDayNumber,
  tripPhase,
  tripTotalDays,
  type TripDates,
  type TripPhase,
} from './trip_dates.ts'
import { hasTag, type DocumentTag, type TripDocument } from './trip_document.ts'
import {
  eventDay,
  isActiveEvent,
  isTransportKind,
  sortedSegments,
  type EventKind,
  type TripEvent,
} from './trip_event.ts'
import { sortedStops, type TripStop } from './trip_stop.ts'
import {
  epochMs,
  localDate,
  localDateTime,
  type IsoInstant,
  type IsoLocalDateTime,
  type ZonedInstant,
} from './zoned_instant.ts'

export interface TodayTrip extends TripDates {
  homeTz: string
  /** UTC offset of `homeTz` at `now`, minutes east of UTC. */
  homeOffsetMin: number
  baseCurrency: string
  budgetTotalMinor: MinorUnits | null
}

export interface TodayStop extends TripStop {
  /** UTC offset of the stop's zone at `now`, minutes east of UTC. */
  offsetMin: number
}

/** Whatever the weather provider cached; the domain only adds its age. */
export interface WeatherSnapshot {
  updatedAt: IsoInstant
}

export interface TodayViewInput<W extends WeatherSnapshot = WeatherSnapshot> {
  trip: TodayTrip
  stops: readonly TodayStop[]
  events: readonly TripEvent[]
  documents: readonly TripDocument[]
  expenses: readonly BudgetExpense[]
  weather?: W | null
  /** Rates for committed costs in another currency, as `budget_status` takes them. */
  rates?: Readonly<Record<string, string>>
  now: IsoInstant
}

export type TodayZoneSource = 'stop' | 'event' | 'home'

export interface NextEvent {
  eventId: string
  /** The segment that is next, when the event has segments. */
  segmentId: string | null
  kind: EventKind
  title: string
  stopId: string | null
  startsAt: IsoInstant
  startsLocal: IsoLocalDateTime
  tz: string | null
  offsetMin: number
  countdownMs: number
  leaveAt: IsoInstant
  leaveAtLocal: IsoLocalDateTime
  leaveBufferMin: number
  travelMin: number
  route: { from: string; to: string } | null
}

export interface TodayDocument {
  documentId: string
  eventId: string | null
  title: string
  tags: readonly DocumentTag[]
  availableOffline: boolean
  /** Why the document shows today. */
  reasons: DocumentTag[]
}

export interface Tonight {
  how: 'lodging' | 'transport'
  eventId: string
  kind: EventKind
  title: string
  placeName: string | null
  address: string | null
  addressLocal: string | null
  phone: string | null
  /** Local check-in or departure wall clock. */
  startsLocal: IsoLocalDateTime
}

export interface TodayView<W extends WeatherSnapshot = WeatherSnapshot> {
  now: IsoInstant
  today: IsoDate
  tz: string
  offsetMin: number
  zoneSource: TodayZoneSource
  phase: TripPhase
  /** "Day 4 of 12"; null outside the trip. */
  dayNumber: number | null
  totalDays: number
  stop: Pick<TripStop, 'id' | 'name' | 'countryCode'> | null
  nextEvent: NextEvent | null
  documents: TodayDocument[]
  tonight: Tonight | null
  /** True when tonight is a trip night with nowhere to sleep. */
  tonightAlert: boolean
  budget: BudgetStatus
  weather: (W & { ageMs: number }) | null
  isDepartureDay: boolean
  isTransportDay: boolean
  isFlightDay: boolean
}

/** The zone a trip-local clock reads, and which rule picked it. */
export interface TripLocalZone {
  tz: string
  offsetMin: number
  source: TodayZoneSource
  stop: TodayStop | null
}

/** What the trip-local zone rule reads: the stops (offsets at `now`), the events and the home zone. */
export interface TripLocalZoneInput {
  stops: readonly TodayStop[]
  events: readonly TripEvent[]
  homeTz: string
  /** UTC offset of `homeTz` at `now`, minutes east of UTC. */
  homeOffsetMin: number
}

/**
 * The trip-local zone at `now`: the stop whose stay covers the local date
 * (read in the stop's own offset), else the zone of the last active event
 * that has started (its arrival zone once it has ended), else home. Today
 * and the reminder planner both read the trip's "today" through this rule.
 */
export function tripLocalZone(input: TripLocalZoneInput, now: IsoInstant): TripLocalZone {
  const nowMs = epochMs(now)
  for (const stop of sortedStops(input.stops)) {
    const local = localDate({ at: now, offsetMin: stop.offsetMin })
    if (stop.arriveOn <= local && local <= stop.departOn) {
      return { tz: stop.tz, offsetMin: stop.offsetMin, source: 'stop', stop }
    }
  }
  let last: TripEvent | null = null
  for (const event of input.events) {
    if (!isActiveEvent(event) || epochMs(event.starts.at) > nowMs) {
      continue
    }
    if (!last || epochMs(event.starts.at) > epochMs(last.starts.at)) {
      last = event
    }
  }
  if (last) {
    const ended = last.ends !== null && epochMs(last.ends.at) <= nowMs
    const zoned: ZonedInstant = ended && last.ends ? last.ends : last.starts
    return {
      tz: zoned.tz ?? input.homeTz,
      offsetMin: zoned.offsetMin,
      source: 'event',
      stop: null,
    }
  }
  return { tz: input.homeTz, offsetMin: input.homeOffsetMin, source: 'home', stop: null }
}

function resolveZone(input: TodayViewInput): TripLocalZone {
  return tripLocalZone(
    {
      stops: input.stops,
      events: input.events,
      homeTz: input.trip.homeTz,
      homeOffsetMin: input.trip.homeOffsetMin,
    },
    input.now
  )
}

interface Candidate {
  event: TripEvent
  segmentId: string | null
  starts: ZonedInstant
  route: { from: string; to: string } | null
}

function nextCandidate(events: readonly TripEvent[], nowMs: number): Candidate | null {
  let best: Candidate | null = null
  let bestMs = Number.POSITIVE_INFINITY
  const consider = (candidate: Candidate) => {
    const ms = epochMs(candidate.starts.at)
    if (ms >= nowMs && ms < bestMs) {
      best = candidate
      bestMs = ms
    }
  }
  for (const event of events) {
    if (event.status === 'cancelled') {
      continue
    }
    const segments = sortedSegments(event)
    if (segments.length === 0) {
      consider({ event, segmentId: null, starts: event.starts, route: null })
      continue
    }
    for (const segment of segments) {
      const route =
        segment.originCode && segment.destCode
          ? { from: segment.originCode, to: segment.destCode }
          : null
      consider({ event, segmentId: segment.id, starts: segment.departs, route })
    }
  }
  return best
}

function nextEvent(events: readonly TripEvent[], nowMs: number): NextEvent | null {
  const candidate = nextCandidate(events, nowMs)
  if (!candidate) {
    return null
  }
  const { event, starts } = candidate
  const startsMs = epochMs(starts.at)
  const leaveMs = leaveAtMs(startsMs, event.kind, event.leaveBufferMin, event.travelMin)
  return {
    eventId: event.id,
    segmentId: candidate.segmentId,
    kind: event.kind,
    title: event.title,
    stopId: event.stopId ?? null,
    startsAt: starts.at,
    startsLocal: localDateTime(starts),
    tz: starts.tz ?? null,
    offsetMin: starts.offsetMin,
    countdownMs: startsMs - nowMs,
    leaveAt: new Date(leaveMs).toISOString(),
    leaveAtLocal: localDateTime({
      at: new Date(leaveMs).toISOString(),
      offsetMin: starts.offsetMin,
    }),
    leaveBufferMin: leaveBufferMin(event.kind, event.leaveBufferMin),
    travelMin: event.travelMin ?? 0,
    route: candidate.route,
  }
}

/** Days on which a non-cancelled event happens: its start day and every segment's departure day. */
function happensOn(event: TripEvent, today: IsoDate): boolean {
  if (eventDay(event) === today) {
    return true
  }
  return sortedSegments(event).some((segment) => localDate(segment.departs) === today)
}

function todayDocuments(
  documents: readonly TripDocument[],
  events: readonly TripEvent[],
  today: IsoDate,
  isFlightDay: boolean
): TodayDocument[] {
  const eventsToday = new Set(
    events
      .filter((event) => event.status !== 'cancelled' && happensOn(event, today))
      .map((e) => e.id)
  )
  const result: TodayDocument[] = []
  for (const document of documents) {
    if (document.deletedAt) {
      continue
    }
    const reasons: DocumentTag[] = []
    if (document.eventId && eventsToday.has(document.eventId)) {
      if (hasTag(document, 'print')) {
        reasons.push('print')
      }
      if (hasTag(document, 'show_on_phone')) {
        reasons.push('show_on_phone')
      }
    }
    if (isFlightDay && hasTag(document, 'requires_passport')) {
      reasons.push('requires_passport')
    }
    if (reasons.length > 0) {
      result.push({
        documentId: document.id,
        eventId: document.eventId,
        title: document.title,
        tags: document.tags,
        availableOffline: document.availableOffline,
        reasons,
      })
    }
  }
  return result
}

function tonightFrom(events: readonly TripEvent[], today: IsoDate): Tonight | null {
  const covers: NightCoverOnNight[] = events.flatMap((event) => nightsCoveredBy(event, [today]))
  const pick =
    covers.find((cover) => cover.how === 'lodging') ??
    covers.find((cover) => cover.how === 'transport') ??
    covers.find((cover) => cover.how === 'override')
  if (!pick) {
    return null
  }
  const event = events.find((e) => e.id === pick.eventId)!
  return {
    how: event.kind === 'lodging' ? 'lodging' : 'transport',
    eventId: event.id,
    kind: event.kind,
    title: event.title,
    placeName: event.placeName ?? null,
    address: event.address ?? null,
    addressLocal: event.addressLocal ?? null,
    phone: event.phone ?? null,
    startsLocal: localDateTime(event.starts),
  }
}

export function todayView<W extends WeatherSnapshot>(input: TodayViewInput<W>): TodayView<W> {
  const nowMs = epochMs(input.now)
  const zone = resolveZone(input)
  const today = localDate({ at: input.now, offsetMin: zone.offsetMin })
  const phase = tripPhase(input.trip, today)

  const activeToday = input.events.filter(
    (event) => isActiveEvent(event) && happensOn(event, today)
  )
  const isFlightDay = activeToday.some((event) => event.kind === 'flight')
  const isTransportDay = activeToday.some((event) => isTransportKind(event.kind))
  const isDepartureDay = today === input.trip.startsOn

  const tonight = isTripNight(input.trip, today) ? tonightFrom(input.events, today) : null
  const tonightAlert = isTripNight(input.trip, today) && tonight === null

  const budget = budgetStatus({
    startsOn: input.trip.startsOn,
    endsOn: input.trip.endsOn,
    budgetTotalMinor: input.trip.budgetTotalMinor,
    baseCurrency: input.trip.baseCurrency,
    today,
    expenses: input.expenses,
    events: input.events,
    rates: input.rates,
  })

  const weather = input.weather
    ? { ...input.weather, ageMs: Math.max(0, nowMs - epochMs(input.weather.updatedAt)) }
    : null

  return {
    now: input.now,
    today,
    tz: zone.tz,
    offsetMin: zone.offsetMin,
    zoneSource: zone.source,
    phase,
    dayNumber: tripDayNumber(input.trip, today),
    totalDays: tripTotalDays(input.trip),
    stop: zone.stop
      ? { id: zone.stop.id, name: zone.stop.name, countryCode: zone.stop.countryCode }
      : null,
    nextEvent: nextEvent(input.events, nowMs),
    documents: todayDocuments(input.documents, input.events, today, isFlightDay),
    tonight,
    tonightAlert,
    budget,
    weather,
    isDepartureDay,
    isTransportDay,
    isFlightDay,
  }
}

/** The date after `today`, exported for callers that show "tomorrow" next to tonight. */
export function tomorrowOf(today: IsoDate): IsoDate {
  return addDays(today, 1)
}
