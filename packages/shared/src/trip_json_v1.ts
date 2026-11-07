import type { Traveller } from './traveller.ts'
import type { Trip } from './trip.ts'
import type { TripMemberRole } from './trip_member_role.ts'
import type { UserProfile } from './user.ts'

export const TRIP_JSON_SCHEMA_VERSION = 1

/**
 * Portable trip document ("trip JSON v1"): what export writes and import
 * reads. Members carry no account ids (they mean nothing in another
 * installation), only their role and display name. Content entities (stops,
 * events, documents...) join with their phase; unknown keys are ignored on
 * import so older files keep working.
 */
export interface TripJsonV1 {
  schemaVersion: typeof TRIP_JSON_SCHEMA_VERSION
  exportedAt: string
  trip: Omit<Trip, 'id' | 'createdBy' | 'deletedAt' | 'createdAt' | 'updatedAt'> & { id: string }
  members: { role: TripMemberRole; displayName: string }[]
  travellers: Omit<Traveller, 'tripId' | 'userId'>[]
}

/** Body of `GET /api/v1/me/export`: the profile plus one trip document per trip. */
export interface AccountExport {
  schemaVersion: typeof TRIP_JSON_SCHEMA_VERSION
  exportedAt: string
  profile: UserProfile
  trips: TripJsonV1[]
}
