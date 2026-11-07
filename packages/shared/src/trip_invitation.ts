import type { InvitableRole } from './trip_member_role.ts'

/** Lifecycle of an invitation; `expired` and later states answer 410 on use. */
export const INVITATION_STATES = ['pending', 'accepted', 'revoked', 'expired'] as const

export type InvitationState = (typeof INVITATION_STATES)[number]

/** An invitation as the owner sees it in the trip's list. The token is never repeated. */
export interface TripInvitation {
  id: string
  tripId: string
  /** Address it was sent to, or null for an invitation by link. */
  email: string | null
  role: InvitableRole
  invitedBy: string | null
  expiresAt: string
  acceptedAt: string | null
  acceptedBy: string | null
  revokedAt: string | null
  state: InvitationState
  createdAt: string
}

/**
 * Answer of `POST /api/v1/trips/:tripId/invitations`. A link invitation
 * (no e-mail) shows its plaintext token exactly once, here, for the owner to
 * share. An e-mail invitation is mailed and its token never leaves the mail:
 * holding it proves the address, so the inviter must not see it.
 */
export type IssuedTripInvitation =
  | {
      invitation: TripInvitation
      delivery: 'link'
      token: string
      /** Absolute URL for the invitee (`<APP_URL>/invite/<token>`). */
      url: string
    }
  | { invitation: TripInvitation; delivery: 'email' }

/** Public preview of `GET /api/v1/invitations/:token`: trip name and role only. */
export interface TripInvitationPreview {
  tripName: string
  role: InvitableRole
  /** True when the invitation was sent to an address, so signup must use it. */
  requiresEmail: boolean
}
