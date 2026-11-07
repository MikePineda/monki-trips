import type { TripMemberRole } from '@monkitrips/shared'

/** Only the owner deletes/restores the trip, manages members and invitations and transfers ownership. */
export function canManageTrip(role: TripMemberRole): boolean {
  return role === 'owner'
}

export interface MemberRemovalInput {
  actorRole: TripMemberRole
  targetRole: TripMemberRole
  /** True when the actor removes their own membership (leaves). */
  actorIsTarget: boolean
}

export type MemberRemovalDecision = 'allowed' | 'E_OWNER_CANNOT_LEAVE' | 'E_TRIP_ROLE'

/**
 * Who may remove whom. The owner removes anyone but themselves (transfer
 * ownership first); an editor may only leave.
 */
export function memberRemoval(input: MemberRemovalInput): MemberRemovalDecision {
  if (input.actorIsTarget) {
    return input.actorRole === 'owner' ? 'E_OWNER_CANNOT_LEAVE' : 'allowed'
  }
  if (!canManageTrip(input.actorRole)) return 'E_TRIP_ROLE'
  if (input.targetRole === 'owner') return 'E_OWNER_CANNOT_LEAVE'
  return 'allowed'
}

export type RoleChangeDecision = 'allowed' | 'E_OWNER_CANNOT_LEAVE' | 'E_TRIP_ROLE'

/**
 * Changing a member's role. Only the owner does it, and the owner's own row
 * is untouchable here: ownership moves through transfer-ownership, never by
 * demotion, so a trip always keeps exactly one owner.
 */
export function roleChange(input: {
  actorRole: TripMemberRole
  targetRole: TripMemberRole
  newRole: TripMemberRole
}): RoleChangeDecision {
  if (!canManageTrip(input.actorRole)) return 'E_TRIP_ROLE'
  if (input.targetRole === 'owner' || input.newRole === 'owner') return 'E_OWNER_CANNOT_LEAVE'
  return 'allowed'
}
