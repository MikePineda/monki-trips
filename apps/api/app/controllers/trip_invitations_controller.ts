import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type {
  ApiEnvelope,
  IssuedTripInvitation,
  TripInvitation as TripInvitationWire,
} from '@monkitrips/shared'
import TripInvitation from '#models/trip_invitation'
import { Clock } from '#services/clock'
import { AuthMails, invitationUrl } from '#services/auth_mails'
import { InvitationAcceptance } from '#services/invitation_acceptance'
import { ApiException } from '#exceptions/api_exception'
import { generateSecureToken, hashToken } from '#domain/secure_token'
import { invitationExpiry } from '#domain/invitation_state'
import { toTripInvitationWire } from '#transformers/trip_invitation_wire'
import { createInvitationValidator } from '#validators/trip_invitation'

/** The owner's side: issue, list and revoke invitations of a trip. */
@inject()
export default class TripInvitationsController {
  constructor(
    private readonly clock: Clock,
    private readonly invitations: InvitationAcceptance,
    private readonly mails: AuthMails
  ) {}

  async index(ctx: HttpContext): Promise<ApiEnvelope<TripInvitationWire[]>> {
    const rows = await TripInvitation.query()
      .where('trip_id', ctx.trip.id)
      .orderBy('created_at', 'desc')
    return { data: rows.map((row) => toTripInvitationWire(row, this.invitations.stateOf(row))) }
  }

  /** The plaintext token appears in this response only; an e-mail invitation is also mailed. */
  async store(ctx: HttpContext): Promise<ApiEnvelope<IssuedTripInvitation>> {
    const body = await ctx.request.validateUsing(createInvitationValidator)
    const inviter = ctx.auth.use('web').getUserOrFail()
    const now = this.clock.now()
    const token = generateSecureToken()
    const invitation = await TripInvitation.create({
      tripId: ctx.trip.id,
      email: body.email ?? null,
      tokenHash: hashToken(token),
      role: body.role ?? 'editor',
      invitedBy: inviter.id,
      expiresAt: DateTime.fromJSDate(invitationExpiry(now)),
    })
    const url = invitationUrl(token)
    if (invitation.email) {
      await this.mails.sendInvitation({
        to: invitation.email,
        tripName: ctx.trip.name,
        inviterName: inviter.displayName,
        url,
        locale: inviter.locale,
      })
    }
    ctx.response.status(201)
    return {
      data: { invitation: toTripInvitationWire(invitation, 'pending'), token, url },
    }
  }

  async destroy(ctx: HttpContext) {
    const { id } = ctx.params as { id: string }
    const invitation = await TripInvitation.query()
      .where('id', id)
      .where('trip_id', ctx.trip.id)
      .first()
    if (!invitation) throw new ApiException('E_ROW_NOT_FOUND')
    if (!invitation.revokedAt && !invitation.acceptedAt) {
      invitation.revokedAt = DateTime.fromJSDate(this.clock.now())
      await invitation.save()
    }
    return ctx.response.noContent()
  }
}
