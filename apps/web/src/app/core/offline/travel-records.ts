import type { Signal } from '@angular/core'
import { liveSignal } from './live'
import type { EventRecord, ExpenseRecord, SegmentRecord, StopRecord, TripRecord } from './records'

/** Everything the travel history, the passport and the map read: every trip on the device. */
export interface TravelRecords {
  /** False until the first answer from the device. */
  loaded: boolean
  trips: TripRecord[]
  stops: StopRecord[]
  events: EventRecord[]
  segments: SegmentRecord[]
  expenses: ExpenseRecord[]
}

const EMPTY: TravelRecords = {
  loaded: false,
  trips: [],
  stops: [],
  events: [],
  segments: [],
  expenses: [],
}

/**
 * A live read of all the trips on this device with their stops, events,
 * legs and expenses (sync keeps every trip of the account here). One
 * Dexie subscription per caller; call it from an injection context.
 */
export function travelRecords(): Signal<TravelRecords> {
  return liveSignal(async (db) => {
    const [trips, stops, events, segments, expenses] = await Promise.all([
      db.trips.toArray(),
      db.stops.toArray(),
      db.events.toArray(),
      db.segments.toArray(),
      db.expenses.toArray(),
    ])
    return { loaded: true, trips, stops, events, segments, expenses }
  }, EMPTY)
}
