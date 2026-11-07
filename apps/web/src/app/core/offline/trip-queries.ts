import type { Signal } from '@angular/core'
import { liveSignalFor } from './live'
import type {
  EventRecord,
  MemberRecord,
  SeatRecord,
  SegmentRecord,
  StopRecord,
  TravellerRecord,
  TripRecord,
} from './records'

/**
 * Live reads of one trip's content from the device, keyed by a trip id
 * signal (the route parameter). Each call opens one Dexie subscription
 * that follows every write; call them from an injection context.
 */
export function tripRecord(tripId: Signal<string>): Signal<TripRecord | null> {
  return liveSignalFor(tripId, async (db, id) => (await db.trips.get(id)) ?? null, null)
}

export function tripStops(tripId: Signal<string>): Signal<StopRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.stops.where('tripId').equals(id).toArray(), [])
}

export function tripEvents(tripId: Signal<string>): Signal<EventRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.events.where('tripId').equals(id).toArray(), [])
}

export function tripSegments(tripId: Signal<string>): Signal<SegmentRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.segments.where('tripId').equals(id).toArray(), [])
}

export function tripSeats(tripId: Signal<string>): Signal<SeatRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.seats.where('tripId').equals(id).toArray(), [])
}

export function tripMembers(tripId: Signal<string>): Signal<MemberRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.members.where('tripId').equals(id).toArray(), [])
}

export function tripTravellers(tripId: Signal<string>): Signal<TravellerRecord[]> {
  return liveSignalFor(
    tripId,
    async (db, id) =>
      (await db.travellers.where('tripId').equals(id).toArray()).sort(
        (a, b) => a.position - b.position
      ),
    []
  )
}
