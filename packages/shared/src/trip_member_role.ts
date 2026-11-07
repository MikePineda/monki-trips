/**
 * Role of a member inside a trip, mirrored by the CHECK constraint on
 * `trip_members.role`. Exactly one `owner` per trip (partial unique index);
 * editors change content, the owner also manages the trip itself. `viewer`
 * arrives later as an additive CHECK change.
 */
export const TRIP_MEMBER_ROLES = ['owner', 'editor'] as const

export type TripMemberRole = (typeof TRIP_MEMBER_ROLES)[number]

/** Roles an invitation can grant: never `owner` (ownership is transferred, not granted). */
export const INVITABLE_ROLES = ['editor'] as const

export type InvitableRole = (typeof INVITABLE_ROLES)[number]
