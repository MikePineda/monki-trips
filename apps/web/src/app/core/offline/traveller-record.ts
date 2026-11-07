import type { Traveller } from '@monkitrips/shared'
import type { TravellerRecord } from './records'

/** The device's row for a traveller the API returned. Pure. */
export function toTravellerRecord(traveller: Traveller): TravellerRecord {
  return {
    id: traveller.id,
    tripId: traveller.tripId,
    displayName: traveller.displayName,
    userId: traveller.userId,
    position: traveller.position,
    updatedAt: traveller.updatedAt ?? '',
  }
}
