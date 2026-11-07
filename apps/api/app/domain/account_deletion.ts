import type { TripMemberRole } from '@monkitrips/shared'

/** Days between `POST /me/delete` and the hard delete; `POST /me/restore` cancels it. */
export const DELETION_GRACE_DAYS = 30

export interface OwnedMembership {
  tripId: string
  role: TripMemberRole
  /** Live members of the trip other than this person. */
  otherMemberCount: number
}

/** When an account whose deletion is requested at `now` is purged. */
export function deletionDate(now: Date): Date {
  return new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60_000)
}

/**
 * Trips this person owns that other people still use. Deleting the account
 * would leave them ownerless, so the request answers 409
 * `E_SOLE_OWNER_OF_SHARED_TRIPS` with these ids until ownership moves.
 */
export function soleOwnedSharedTrips(memberships: OwnedMembership[]): string[] {
  return memberships
    .filter((membership) => membership.role === 'owner' && membership.otherMemberCount > 0)
    .map((membership) => membership.tripId)
}
