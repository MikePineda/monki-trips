/**
 * Where the weather of a trip day is read: the place you are at (or will
 * be at) on that local date. The stop covering the date wins, the one
 * arrived at last on a travel day; without placed stops, the lodging that
 * covers the date (first night to checkout day). Coordinates only: no
 * address or person leaves the server with them.
 */
import type { IsoDate } from './iso_date.ts'
import type { EventKind, EventStatus } from './trip_event.ts'

export interface WeatherPlaceStop {
  id: string
  position: number
  name: string
  lat: number | null
  lng: number | null
  arriveOn: IsoDate | null
  departOn: IsoDate | null
  deletedAt: string | null
}

export interface WeatherPlaceEvent {
  id: string
  kind: EventKind
  status: EventStatus
  title: string
  placeName: string | null
  startsOn: IsoDate | null
  /** Local end, `YYYY-MM-DDTHH:mm[:ss]`; its date is the checkout day. */
  endsLocal: string | null
  lat: number | null
  lng: number | null
  deletedAt: string | null
}

export interface WeatherPlace {
  /** The stop the place comes from, or null when it is a lodging's. */
  stopId: string | null
  name: string
  lat: number
  lng: number
}

function placed<T extends { lat: number | null; lng: number | null }>(
  row: T
): row is T & { lat: number; lng: number } {
  return typeof row.lat === 'number' && typeof row.lng === 'number'
}

export function weatherPlaceOn(
  date: IsoDate,
  stops: readonly WeatherPlaceStop[],
  events: readonly WeatherPlaceEvent[]
): WeatherPlace | null {
  const covering = stops
    .filter(
      (stop) =>
        !stop.deletedAt &&
        placed(stop) &&
        stop.arriveOn !== null &&
        stop.departOn !== null &&
        stop.arriveOn <= date &&
        date <= stop.departOn
    )
    .sort((a, b) => b.position - a.position || (b.arriveOn ?? '').localeCompare(a.arriveOn ?? ''))
  const stop = covering[0]
  if (stop && placed(stop)) {
    return { stopId: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng }
  }
  for (const event of events) {
    if (
      event.kind !== 'lodging' ||
      event.status === 'cancelled' ||
      event.deletedAt ||
      !placed(event) ||
      !event.startsOn
    ) {
      continue
    }
    const checkout = event.endsLocal ? event.endsLocal.slice(0, 10) : event.startsOn
    if (event.startsOn <= date && date <= checkout) {
      return { stopId: null, name: event.placeName ?? event.title, lat: event.lat, lng: event.lng }
    }
  }
  return null
}

/** A coordinate rounded to two decimals (about 1 km), the key of the shared weather cache. */
export function roundCoordinate(value: number): number {
  // Shifting through the exponent avoids binary drift (120.005 * 100 is 12000.4999…).
  const rounded = Number(`${Math.round(Number(`${Math.abs(value)}e2`))}e-2`)
  return value < 0 && rounded !== 0 ? -rounded : rounded
}
