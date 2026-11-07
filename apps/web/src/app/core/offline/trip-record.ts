import type { Trip } from '@monkitrips/shared'
import type { TripRecord } from './records'

/** The device's row for a trip the API returned. Pure. */
export function toTripRecord(trip: Trip): TripRecord {
  return {
    id: trip.id,
    name: trip.name,
    startDate: trip.startsOn,
    endDate: trip.endsOn,
    baseCurrency: trip.baseCurrency,
    budgetMode: trip.budgetMode,
    budgetTotalMinor: trip.budgetTotalMinor,
    homeTz: trip.homeTz,
    updatedAt: trip.updatedAt,
  }
}
