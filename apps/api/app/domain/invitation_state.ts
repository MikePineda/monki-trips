import type { InvitationState } from '@monkitrips/shared'

/** Invitations live for seven days from creation. */
export const INVITATION_TTL_DAYS = 7

export interface InvitationFacts {
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
}

/** When an invitation created at `now` expires. */
export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60_000)
}

/**
 * The state of an invitation at `now`. Accepted and revoked are terminal
 * whatever the date; a pending one expires when its date passes. Anything
 * but `pending` answers 410 on use.
 */
export function invitationState(invitation: InvitationFacts, now: Date): InvitationState {
  if (invitation.acceptedAt) return 'accepted'
  if (invitation.revokedAt) return 'revoked'
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'pending'
}
