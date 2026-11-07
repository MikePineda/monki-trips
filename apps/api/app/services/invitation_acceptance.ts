import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Trip from '#models/trip'
import TripInvitation from '#models/trip_invitation'
import TripMember from '#models/trip_member'
import Traveller from '#models/traveller'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { ApiException } from '#exceptions/api_exception'
import { hashToken } from '#domain/secure_token'
import { invitationState } from '#domain/invitation_state'

/**
 * Looks invitations up by their plaintext token and turns an accepted one
 * into a membership plus a traveller, in one transaction. Single use: the
 * row is stamped `acceptedAt`/`acceptedBy` and answers 410 afterwards.
 */
@inject()
export class InvitationAcceptance {
  constructor(private readonly clock: Clock) {}

  /** The invitation behind a token, whatever its state; null when the token is unknown. */
  async findByToken(token: string): Promise<TripInvitation | null> {
    return TripInvitation.query().where('token_hash', hashToken(token)).preload('trip').first()
  }

  /** A pending invitation of a live trip, or 404 (unknown) / 410 (anything but pending). */
  async findPendingOrFail(token: string): Promise<TripInvitation> {
    const invitation = await this.findByToken(token)
    if (!invitation || invitation.trip.deletedAt) throw new ApiException('E_ROW_NOT_FOUND')
    if (this.stateOf(invitation) !== 'pending') throw new ApiException('E_INVITATION_EXPIRED')
    return invitation
  }

  stateOf(invitation: TripInvitation) {
    return invitationState(
      {
        expiresAt: invitation.expiresAt.toJSDate(),
        acceptedAt: invitation.acceptedAt?.toJSDate() ?? null,
        revokedAt: invitation.revokedAt?.toJSDate() ?? null,
      },
      this.clock.now()
    )
  }

  /**
   * Joins `user` to the invitation's trip. An address-bound invitation must
   * match the account's e-mail (403). Someone who is already a member keeps
   * their row; the invitation is consumed either way.
   */
  async accept(invitation: TripInvitation, user: User): Promise<Trip> {
    if (invitation.email && invitation.email !== user.email) {
      throw new ApiException('E_INVITATION_EMAIL_MISMATCH')
    }
    const now = DateTime.fromJSDate(this.clock.now())
    await db.transaction(async (trx) => {
      const existing = await TripMember.query({ client: trx })
        .where('trip_id', invitation.tripId)
        .where('user_id', user.id)
        .whereNull('deleted_at')
        .first()
      if (!existing) {
        await TripMember.create(
          {
            tripId: invitation.tripId,
            userId: user.id,
            role: invitation.role,
            joinedAt: now,
            updatedBy: user.id,
          },
          { client: trx }
        )
      }
      const traveller = await Traveller.query({ client: trx })
        .where('trip_id', invitation.tripId)
        .where('user_id', user.id)
        .whereNull('deleted_at')
        .first()
      if (!traveller) {
        const last = await Traveller.query({ client: trx })
          .where('trip_id', invitation.tripId)
          .whereNull('deleted_at')
          .max('position as max')
          .first()
        const { max } = (last?.$extras ?? {}) as { max?: string | number | null }
        const position = Number(max ?? -1) + 1
        await Traveller.create(
          {
            tripId: invitation.tripId,
            userId: user.id,
            displayName: user.displayName,
            position,
            updatedBy: user.id,
          },
          { client: trx }
        )
      }
      invitation.useTransaction(trx)
      invitation.acceptedAt = now
      invitation.acceptedBy = user.id
      await invitation.save()
    })
    return invitation.trip
  }
}
