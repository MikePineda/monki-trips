import type { Traveller as TravellerWire } from '@monkitrips/shared'
import type Traveller from '#models/traveller'

export function toTravellerWire(traveller: Traveller): TravellerWire {
  return {
    id: traveller.id,
    tripId: traveller.tripId,
    displayName: traveller.displayName,
    userId: traveller.userId,
    position: traveller.position,
    createdAt: traveller.createdAt.toISO() ?? undefined,
  }
}
