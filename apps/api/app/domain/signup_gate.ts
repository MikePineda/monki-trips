import type { InvitationState } from '@monkitrips/shared'

export interface SignupGateInput {
  /** `REGISTRATION_OPEN` of the deployment. */
  registrationOpen: boolean
  /** Normalized address the person signs up with. */
  email: string
  /** The invitation behind `invitationToken`, when one was sent and found. */
  invitation?: { state: InvitationState; email: string | null } | null
  /** True when a token was sent but matched no invitation. */
  unknownInvitation?: boolean
}

export type SignupGateDecision =
  | { allowed: true; viaInvitation: boolean; emailVerifiedByInvitation: boolean }
  | {
      allowed: false
      code: 'E_REGISTRATION_CLOSED' | 'E_INVITATION_EXPIRED' | 'E_INVITATION_EMAIL_MISMATCH'
    }

/**
 * Whether a signup may proceed. A valid invitation always lets someone in
 * (that is how the owner's partner joins while registration is closed), and
 * an invitation addressed to an e-mail proves that address. Without an
 * invitation, the deployment's `REGISTRATION_OPEN` decides.
 */
export function signupGate(input: SignupGateInput): SignupGateDecision {
  const { invitation } = input
  if (invitation) {
    if (invitation.state !== 'pending') return { allowed: false, code: 'E_INVITATION_EXPIRED' }
    if (invitation.email && invitation.email !== input.email) {
      return { allowed: false, code: 'E_INVITATION_EMAIL_MISMATCH' }
    }
    return { allowed: true, viaInvitation: true, emailVerifiedByInvitation: !!invitation.email }
  }
  if (input.unknownInvitation) return { allowed: false, code: 'E_INVITATION_EXPIRED' }
  if (!input.registrationOpen) return { allowed: false, code: 'E_REGISTRATION_CLOSED' }
  return { allowed: true, viaInvitation: false, emailVerifiedByInvitation: false }
}
