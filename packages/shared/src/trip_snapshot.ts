import type { Traveller } from './traveller.ts'
import type { Trip } from './trip.ts'
import type { TripMember } from './trip_member.ts'

/**
 * Full state of one trip (`GET /api/v1/trips/:tripId/snapshot`): the base of
 * the export and of the AI context. Entities join it with their phase.
 */
export interface TripSnapshot {
  trip: Trip
  members: TripMember[]
  travellers: Traveller[]
}
