import {
  addDays,
  compareIsoDate,
  daysBetween,
  isTransportKind,
  isoDateRange,
  routeChips,
  type EventKind,
  type EventSegmentRow,
  type EventStatus,
  type IsoDate,
  type TripDates,
  type TripEventRow,
  type TripStopRow,
} from '@monkitrips/shared'
import { localClock, localDateOf } from './zoned-time'

/** What a row stands for: an event's start, a transport's arrival, or a night of lodging. */
export type DayItemRole = 'start' | 'arrival' | 'check-in' | 'stay' | 'check-out'

export interface DayItem {
  /** Unique within the list: `<eventId>:<role>[:<date>]`. */
  key: string
  eventId: string
  kind: EventKind
  status: EventStatus
  role: DayItemRole
  title: string
  /** Local clock `HH:mm`, null for an all-day row (a night in the middle of a stay). */
  time: string | null
  /** The instant of `time` (epoch ms) and the zone it is read in, for the zone label. */
  atMs: number | null
  zone: string | null
  /** "Night N of M" for lodging rows. */
  night?: { number: number; total: number }
  /** Codes of the legs (`PVM → ALD → KSB`) for a transport with segments. */
  route?: string[]
  /** Carrier and number of the first leg. */
  carrier?: string | null
  syncState?: 'pending' | 'failed'
}

export interface ItineraryDay {
  date: IsoDate
  /** 1-based within the trip, null for a date outside its dates. */
  dayNumber: number | null
  /** One route chip per leg of the day, else the stops the day belongs to. */
  chips: string[][]
  items: DayItem[]
}

/** The stored rows, with or without the tombstone column (the device keeps them without). */
type EventRow = Omit<TripEventRow, 'deletedAt'> & { syncState?: 'pending' | 'failed' }
type SegmentRow = Omit<EventSegmentRow, 'deletedAt'>
type StopRow = Omit<TripStopRow, 'deletedAt'>

/**
 * The itinerary, one section per calendar date. Days are cut by the
 * place's local date (`startsOn`, the local date of the start in the
 * event's own zone), never by the device's clock. Lodging spans its
 * nights: a check-in row, an all-day row on every night in between and a
 * check-out row. A transport that arrives on another local date gets an
 * arrival row there. Every date of the trip is a section even when empty
 * (a free day); dates with items outside the trip are added. Pure.
 */
export function itineraryDays(
  trip: TripDates,
  events: readonly EventRow[],
  segments: readonly SegmentRow[],
  stops: readonly StopRow[]
): ItineraryDay[] {
  const byDate = new Map<IsoDate, DayItem[]>()
  const chipsByDate = new Map<IsoDate, string[][]>()
  const put = (date: IsoDate, item: DayItem) => {
    const items = byDate.get(date) ?? []
    items.push(item)
    byDate.set(date, items)
  }
  const chip = (date: IsoDate, codes: string[]) => {
    const chips = chipsByDate.get(date) ?? []
    chips.push(codes)
    chipsByDate.set(date, chips)
  }

  for (const event of events) {
    const legs = segments
      .filter((segment) => segment.eventId === event.id)
      .sort((a, b) => a.position - b.position)
    const base = {
      eventId: event.id,
      kind: event.kind,
      status: event.status,
      title: event.title,
      ...(event.syncState ? { syncState: event.syncState } : {}),
    }
    if (legs.length > 0) {
      const first = legs[0]
      const last = legs[legs.length - 1]
      const date = localDateOf(first.departsLocal)
      const route = [first.originCode ?? first.originName ?? '', ...legs.map(destLabel)]
      put(date, {
        ...base,
        key: `${event.id}:start`,
        role: 'start',
        time: localClock(first.departsLocal),
        atMs: ms(first.departsAt),
        zone: first.departsTz,
        route,
        carrier: carrierLabel(first),
      })
      chip(date, route)
      const arrivalDate = localDateOf(last.arrivesLocal)
      if (arrivalDate !== date) {
        put(arrivalDate, {
          ...base,
          key: `${event.id}:arrival`,
          role: 'arrival',
          time: localClock(last.arrivesLocal),
          atMs: ms(last.arrivesAt),
          zone: last.arrivesTz,
          route,
        })
      }
      continue
    }
    if (!event.startsLocal || !event.startsOn) {
      continue
    }
    const start = event.startsOn
    if (event.kind === 'lodging') {
      const checkOut = event.endsLocal ? localDateOf(event.endsLocal) : addDays(start, 1)
      const total = Math.max(1, daysBetween(start, checkOut))
      put(start, {
        ...base,
        key: `${event.id}:check-in`,
        role: 'check-in',
        time: localClock(event.startsLocal),
        atMs: ms(event.startsAt),
        zone: event.startTz,
        night: { number: 1, total },
      })
      for (let number = 2; number <= total; number += 1) {
        const date = addDays(start, number - 1)
        put(date, {
          ...base,
          key: `${event.id}:stay:${date}`,
          role: 'stay',
          time: null,
          atMs: null,
          zone: null,
          night: { number, total },
        })
      }
      const out = compareIsoDate(checkOut, start) > 0 ? checkOut : addDays(start, 1)
      put(out, {
        ...base,
        key: `${event.id}:check-out`,
        role: 'check-out',
        time: event.endsLocal ? localClock(event.endsLocal) : null,
        atMs: ms(event.endsAt),
        zone: event.endTz ?? event.startTz,
        night: { number: total, total },
      })
      continue
    }
    put(start, {
      ...base,
      key: `${event.id}:start`,
      role: 'start',
      time: localClock(event.startsLocal),
      atMs: ms(event.startsAt),
      zone: event.startTz,
    })
    if (isTransportKind(event.kind) && event.endsLocal) {
      const arrivalDate = localDateOf(event.endsLocal)
      if (arrivalDate !== start) {
        put(arrivalDate, {
          ...base,
          key: `${event.id}:arrival`,
          role: 'arrival',
          time: localClock(event.endsLocal),
          atMs: ms(event.endsAt),
          zone: event.endTz ?? event.startTz,
        })
      }
    }
  }

  const tripDates = isoDateRange(trip.startsOn, addDays(trip.endsOn, 1))
  const dates = [...new Set([...tripDates, ...byDate.keys()])].sort(compareIsoDate)
  return dates.map((date) => ({
    date,
    dayNumber: tripDates.includes(date) ? daysBetween(trip.startsOn, date) + 1 : null,
    chips: chipsByDate.get(date) ?? stopChips(stops, date),
    items: (byDate.get(date) ?? []).sort(byTime),
  }))
}

/** The stops a date belongs to, as one chip (`A → B` on a day that moves from one to the next). */
function stopChips(stops: readonly StopRow[], date: IsoDate): string[][] {
  const covering = stops.filter(
    (stop) =>
      stop.arriveOn !== null &&
      stop.departOn !== null &&
      compareIsoDate(stop.arriveOn, date) <= 0 &&
      compareIsoDate(date, stop.departOn) <= 0
  )
  const labels = routeChips(covering).map((chip) => chip.label)
  return labels.length > 0 ? [labels] : []
}

function destLabel(segment: SegmentRow): string {
  return segment.destCode ?? segment.destName ?? ''
}

function carrierLabel(segment: SegmentRow): string | null {
  const parts = [segment.carrier, segment.number].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

function ms(at: string | null): number | null {
  if (!at) {
    return null
  }
  const value = Date.parse(at)
  return Number.isNaN(value) ? null : value
}

/** All-day rows first, then by local clock, then by title. */
function byTime(a: DayItem, b: DayItem): number {
  if (a.time === null || b.time === null) {
    return a.time === b.time ? a.title.localeCompare(b.title) : a.time === null ? -1 : 1
  }
  return a.time.localeCompare(b.time) || a.title.localeCompare(b.title)
}
