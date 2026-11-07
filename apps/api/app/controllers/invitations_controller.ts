import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, Trip as TripWire, TripInvitationPreview } from '@monkitrips/shared'
import { Clock } from '#services/clock'
import { InvitationAcceptance } from '#services/invitation_acceptance'
import { ApiException } from '#exceptions/api_exception'
import { toTripWire } from '#transformers/trip_wire'

/**
 * The invitee's side of an invitation, addressed by its plaintext token.
 * The preview is public and says only what is needed to decide: the trip's
 * name and the role offered.
 */
@inject()
export default class InvitationsController {
  constructor(
    private readonly clock: Clock,
    private readonly invitations: InvitationAcceptance
  ) {}

  async show(ctx: HttpContext): Promise<ApiEnvelope<TripInvitationPreview>> {
    const { token } = ctx.params as { token: string }
    const invitation = await this.invitations.findPendingOrFail(token)
    return {
      data: {
        tripName: invitation.trip.name,
        role: invitation.role,
        requiresEmail: invitation.email !== null,
      },
    }
  }

  /**
   * Joins the signed-in person. An invitation sent to their own address
   * also verifies it; anyone else needs a verified address first.
   */
  async accept(ctx: HttpContext): Promise<ApiEnvelope<TripWire>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const { token } = ctx.params as { token: string }
    const invitation = await this.invitations.findPendingOrFail(token)
    if (invitation.email && invitation.email !== user.email) {
      throw new ApiException('E_INVITATION_EMAIL_MISMATCH')
    }
    if (!user.emailVerifiedAt) {
      if (!invitation.email) throw new ApiException('E_EMAIL_NOT_VERIFIED')
      user.emailVerifiedAt = DateTime.fromJSDate(this.clock.now())
      await user.save()
    }
    const trip = await this.invitations.accept(invitation, user)
    ctx.response.status(201)
    return { data: toTripWire(trip) }
  }
}
