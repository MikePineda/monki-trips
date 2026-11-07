import type { TripMember as TripMemberWire } from '@monkitrips/shared'
import type TripMember from '#models/trip_member'

/** A membership with the account's display name (the `user` relation must be loaded). */
export function toTripMemberWire(member: TripMember): TripMemberWire {
  return {
    id: member.id,
    tripId: member.tripId,
    userId: member.userId,
    role: member.role,
    displayName: member.user.displayName,
    joinedAt: member.joinedAt.toISO()!,
  }
}
