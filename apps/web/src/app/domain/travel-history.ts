import {
  isTransportKind,
  routeChips,
  sortedStops,
  tripSummary,
  type EventKind,
  type EventStatus,
  type PassportArrival,
  type PassportInput,
  type TripPhase,
} from '@monkitrips/shared'

/**
 * The device's trips as a travel history: one entry per trip for its
 * ticket on the trip list, a map colour per trip, and the input of the
 * passport (trips, stops and the day each transport lands). Pure: plain
 * row shapes in, no Dexie, no clock.
 */

export interface HistoryTripRow {
  id: string
  name: string
  startDate: string
  endDate: string
  baseCurrency: string
}

export interface HistoryStopRow {
  id: string
  tripId: string
  position: number
  name: string
  countryCode: string | null
  arriveOn: string | null
  departOn: string | null
  lat: number | null
  lng: number | null
}

export interface HistoryExpenseRow {
  tripId: string
  /** Null while the rate is missing: not counted yet. */
  baseAmountMinor: number | null
}

export interface HistoryEventRow {
  id: string
  tripId: string
  kind: EventKind
  status: EventStatus
  startsOn: string | null
  endsLocal: string | null
}

export interface HistorySegmentRow {
  eventId: string
  position: number
  arrivesLocal: string | null
}

/** The map colours: `--series-1` … `--series-8`. */
export type TripSeries = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface HistoryEntry {
  id: string
  name: string
  startsOn: string
  endsOn: string
  phase: TripPhase
  route: string[]
  days: number
  nights: number
  countries: string[]
  /** Spent so far in the base currency (expenses with a rate). */
  spentMinor: number
  currency: string
  /** The first stop with a country: the trip's cover stamp. */
  cover: { code: string; name: string; date: string } | null
}

/** Stops in itinerary order (position, then arrival, then name). */
function ordered<T extends HistoryStopRow>(stops: readonly T[]): T[] {
  return sortedStops(stops).sort(
    (a, b) =>
      a.position - b.position ||
      (a.arriveOn ?? '').localeCompare(b.arriveOn ?? '') ||
      a.name.localeCompare(b.name)
  )
}

export function historyEntries(input: {
  trips: readonly HistoryTripRow[]
  stops: readonly HistoryStopRow[]
  expenses: readonly HistoryExpenseRow[]
  today: string
}): HistoryEntry[] {
  return input.trips.map((trip) => {
    const stops = ordered(input.stops.filter((stop) => stop.tripId === trip.id))
    const summary = tripSummary(
      { startsOn: trip.startDate, endsOn: trip.endDate },
      stops,
      input.today
    )
    const first = stops.find((stop) => stop.countryCode && stop.name.trim() !== '')
    const spentMinor = input.expenses
      .filter((expense) => expense.tripId === trip.id && expense.baseAmountMinor !== null)
      .reduce((sum, expense) => sum + (expense.baseAmountMinor ?? 0), 0)
    return {
      id: trip.id,
      name: trip.name,
      startsOn: trip.startDate,
      endsOn: trip.endDate,
      phase: summary.phase,
      route: routeChips(stops).map((chip) => chip.label),
      days: summary.totalDays,
      nights: summary.nights,
      countries: summary.countries,
      spentMinor,
      currency: trip.baseCurrency,
      cover: first?.countryCode
        ? {
            code: first.countryCode,
            name: first.name.trim(),
            date: first.arriveOn ?? trip.startDate,
          }
        : null,
    }
  })
}

/** One colour per trip, by departure (oldest first), cycling through the eight series. */
export function tripSeries(
  trips: readonly Pick<HistoryTripRow, 'id' | 'startDate'>[]
): Map<string, TripSeries> {
  const sorted = [...trips].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)
  )
  return new Map(sorted.map((trip, index) => [trip.id, ((index % 8) + 1) as TripSeries]))
}

/** The day a transport lands: its last leg, else its local end, else the day it starts. */
function arrivesOn(event: HistoryEventRow, segments: readonly HistorySegmentRow[]): string | null {
  const legs = segments
    .filter((segment) => segment.eventId === event.id && segment.arrivesLocal)
    .sort((a, b) => a.position - b.position)
  const landing = legs.at(-1)?.arrivesLocal ?? event.endsLocal
  return landing ? landing.slice(0, 10) : event.startsOn
}

export function passportInput(input: {
  trips: readonly Pick<HistoryTripRow, 'id' | 'name' | 'startDate' | 'endDate'>[]
  stops: readonly HistoryStopRow[]
  events: readonly HistoryEventRow[]
  segments: readonly HistorySegmentRow[]
  today: string
}): PassportInput {
  const arrivals: PassportArrival[] = input.events
    .filter((event) => isTransportKind(event.kind))
    .map((event) => ({
      tripId: event.tripId,
      kind: event.kind,
      status: event.status,
      arrivesOn: arrivesOn(event, input.segments),
    }))
  return {
    trips: input.trips.map((trip) => ({
      id: trip.id,
      name: trip.name,
      startsOn: trip.startDate,
      endsOn: trip.endDate,
    })),
    stops: input.stops,
    arrivals,
    today: input.today,
  }
}
