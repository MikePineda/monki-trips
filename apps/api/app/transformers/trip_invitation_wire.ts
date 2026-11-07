import type { InvitationState, TripInvitation as TripInvitationWire } from '@monkitrips/shared'
import type TripInvitation from '#models/trip_invitation'

/** An invitation for the owner's list; the token hash never leaves the server. */
export function toTripInvitationWire(
  invitation: TripInvitation,
  state: InvitationState
): TripInvitationWire {
  return {
    id: invitation.id,
    tripId: invitation.tripId,
    email: invitation.email,
    role: invitation.role,
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt.toISO()!,
    acceptedAt: invitation.acceptedAt?.toISO() ?? null,
    acceptedBy: invitation.acceptedBy,
    revokedAt: invitation.revokedAt?.toISO() ?? null,
    state,
    createdAt: invitation.createdAt.toISO()!,
  }
}
