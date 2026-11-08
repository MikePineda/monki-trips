/**
 * The passport: one stamp per country visited and, inside it, one per city.
 * A place is earned once a stop there is behind us (its `departOn` is before
 * `today`) or belongs to a trip that is over; until then it is "coming up".
 * A place counts once: its stamp is the first earned visit, else the first
 * planned one, and every visit stays listed for the "when and on which trip"
 * detail. Cities are matched by country and trimmed, case-folded name.
 */
import { compareIsoDate, type IsoDate } from './iso_date.ts'
import { tripPhase, type TripDates } from './trip_dates.ts'
import type { EventKind, EventStatus } from './trip_event.ts'

/** How the travellers reached a place: the icon of its stamp. */
export type ArrivalMode = 'plane' | 'train' | 'boat' | 'road'

export interface PassportTrip extends TripDates {
  id: string
  name: string
}

export interface PassportStop {
  id: string
  tripId: string
  position: number
  name: string
  /** ISO 3166-1 alpha-2, uppercase, or null when unknown. */
  countryCode: string | null
  arriveOn: IsoDate | null
  departOn: IsoDate | null
  lat?: number | null
  lng?: number | null
}

/** A transport event, reduced to the day it lands. */
export interface PassportArrival {
  tripId: string
  kind: EventKind
  status: EventStatus
  /** Local arrival date at the destination, or null when unknown. */
  arrivesOn: IsoDate | null
}

export interface PassportInput {
  trips: readonly PassportTrip[]
  stops: readonly PassportStop[]
  arrivals: readonly PassportArrival[]
  today: IsoDate
}

export interface PlaceVisit {
  tripId: string
  tripName: string
  stopId: string
  /** Arrival day (the trip's first day for an undated stop). */
  date: IsoDate
  earned: boolean
  arrivedBy: ArrivalMode | null
}

interface StampFields {
  /** True once any visit is behind us. */
  earned: boolean
  /** The date on the stamp: the first earned visit, else the first planned one. */
  date: IsoDate
  /** The trip of that visit. */
  tripId: string
  tripName: string
  arrivedBy: ArrivalMode | null
  /** Every visit in date order. */
  visits: PlaceVisit[]
}

export interface CityStamp extends StampFields {
  name: string
  countryCode: string
  coordinates: { lat: number; lng: number } | null
}

export interface CountryStamp extends StampFields {
  code: string
  /** In the order they were stamped. */
  cities: CityStamp[]
}

const MODE_BY_KIND: Partial<Record<EventKind, ArrivalMode>> = {
  flight: 'plane',
  train: 'train',
  ferry: 'boat',
  bus: 'road',
  car: 'road',
}

export function arrivalMode(kind: EventKind): ArrivalMode | null {
  return MODE_BY_KIND[kind] ?? null
}

function cityKey(countryCode: string, name: string): string {
  return `${countryCode}|${name.trim().toLocaleLowerCase()}`
}

function byVisit(a: PlaceVisit, b: PlaceVisit): number {
  return compareIsoDate(a.date, b.date) || a.stopId.localeCompare(b.stopId)
}

/** The visit a stamp shows: the first earned one, else the first planned one. */
function stampFields(visits: PlaceVisit[]): StampFields {
  const sorted = [...visits].sort(byVisit)
  const shown = sorted.find((visit) => visit.earned) ?? sorted[0]
  return {
    earned: shown.earned,
    date: shown.date,
    tripId: shown.tripId,
    tripName: shown.tripName,
    arrivedBy: shown.arrivedBy,
    visits: sorted,
  }
}

/** Earned stamps first, each group in date order. */
function byStamp(a: StampFields, b: StampFields): number {
  if (a.earned !== b.earned) {
    return a.earned ? -1 : 1
  }
  return compareIsoDate(a.date, b.date)
}

export function passportStamps(input: PassportInput): CountryStamp[] {
  const trips = new Map(input.trips.map((trip) => [trip.id, trip]))
  const cities = new Map<
    string,
    { countryCode: string; coordinates: CityStamp['coordinates']; visits: PlaceVisit[] }
  >()
  const names = new Map<string, string>()

  const ordered = [...input.stops].sort(
    (a, b) => a.tripId.localeCompare(b.tripId) || a.position - b.position
  )
  for (const stop of ordered) {
    const trip = trips.get(stop.tripId)
    const name = stop.name.trim()
    if (!trip || !stop.countryCode || name === '') {
      continue
    }
    const tripOver = tripPhase(trip, input.today) === 'past'
    const left = stop.departOn !== null && compareIsoDate(stop.departOn, input.today) < 0
    const date = stop.arriveOn ?? trip.startsOn
    const arrival = input.arrivals
      .filter(
        (candidate) =>
          candidate.tripId === trip.id &&
          candidate.arrivesOn === date &&
          candidate.status !== 'cancelled' &&
          candidate.status !== 'idea' &&
          arrivalMode(candidate.kind) !== null
      )
      .at(-1)
    const visit: PlaceVisit = {
      tripId: trip.id,
      tripName: trip.name,
      stopId: stop.id,
      date,
      earned: tripOver || left,
      arrivedBy: arrival ? arrivalMode(arrival.kind) : null,
    }
    names.set(stop.id, name)
    const key = cityKey(stop.countryCode, name)
    const city = cities.get(key)
    const coordinates =
      typeof stop.lat === 'number' && typeof stop.lng === 'number'
        ? { lat: stop.lat, lng: stop.lng }
        : null
    if (city) {
      city.visits.push(visit)
      city.coordinates ??= coordinates
    } else {
      cities.set(key, { countryCode: stop.countryCode, coordinates, visits: [visit] })
    }
  }

  const countries = new Map<string, CityStamp[]>()
  for (const city of cities.values()) {
    const fields = stampFields(city.visits)
    const stamp: CityStamp = {
      // The first visit decides the city's spelling.
      name: names.get(fields.visits[0].stopId) ?? '',
      countryCode: city.countryCode,
      coordinates: city.coordinates,
      ...fields,
    }
    countries.set(city.countryCode, [...(countries.get(city.countryCode) ?? []), stamp])
  }

  for (const list of countries.values()) {
    list.sort(byStamp)
  }

  return [...countries.entries()]
    .map(([code, list]) => ({
      code,
      cities: list,
      ...stampFields(list.flatMap((city) => city.visits)),
    }))
    .sort(byStamp)
}
