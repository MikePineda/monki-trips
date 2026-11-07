import type { TripMemberRole } from './trip_member_role.ts'

/** A person with an account who belongs to a trip. */
export interface TripMember {
  id: string
  tripId: string
  userId: string
  role: TripMemberRole
  /** Display name of the account, denormalised for the members screen. */
  displayName: string
  joinedAt: string
}
