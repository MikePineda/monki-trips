import type { TripMember } from '@monkitrips/shared'
import type { MemberRecord } from './records'

/** The device's row for a trip membership the API returned. Pure. */
export function toMemberRecord(member: TripMember): MemberRecord {
  return {
    id: member.id,
    tripId: member.tripId,
    userId: member.userId,
    role: member.role,
    displayName: member.displayName,
    updatedAt: member.updatedAt ?? member.joinedAt,
  }
}
