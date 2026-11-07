import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ApiEnvelope, TripMember as TripMemberWire } from '@monkitrips/shared'
import TripMember from '#models/trip_member'
import { Clock } from '#services/clock'
import { TripMembership } from '#services/trip_membership'
import { ApiException } from '#exceptions/api_exception'
import { memberRemoval, roleChange } from '#domain/trip_roles'
import { toTripMemberWire } from '#transformers/trip_member_wire'
import { updateMemberValidator } from '#validators/trip_member'

/**
 * Members of a trip. Every member may list them and leave; only the owner
 * changes roles and removes others, and the owner never leaves (ownership
 * is transferred first). Removal is a soft delete: a sync tombstone.
 */
@inject()
export default class TripMembersController {
  constructor(
    private readonly clock: Clock,
    private readonly memberships: TripMembership
  ) {}

  async index(ctx: HttpContext): Promise<ApiEnvelope<TripMemberWire[]>> {
    const members = await this.memberships.membersOf(ctx.trip.id)
    return { data: members.map(toTripMemberWire) }
  }

  async update(ctx: HttpContext): Promise<ApiEnvelope<TripMemberWire>> {
    const { role } = await ctx.request.validateUsing(updateMemberValidator)
    const target = await this.findMember(ctx)
    await db.transaction(async (trx) => {
      const { actor, fresh } = await this.lockPair(trx, ctx, target)
      const decision = roleChange({ actorRole: actor.role, targetRole: fresh.role, newRole: role })
      if (decision !== 'allowed') throw new ApiException(decision)
      fresh.role = role
      fresh.updatedBy = actor.userId
      await fresh.save()
      target.merge({ role: fresh.role, updatedBy: fresh.updatedBy })
    })
    return { data: toTripMemberWire(target) }
  }

  async destroy(ctx: HttpContext) {
    const target = await this.findMember(ctx)
    await db.transaction(async (trx) => {
      const { actor, fresh } = await this.lockPair(trx, ctx, target)
      const decision = memberRemoval({
        actorRole: actor.role,
        targetRole: fresh.role,
        actorIsTarget: fresh.id === actor.id,
      })
      if (decision !== 'allowed') throw new ApiException(decision)
      fresh.deletedAt = DateTime.fromJSDate(this.clock.now())
      fresh.updatedBy = actor.userId
      await fresh.save()
    })
    return ctx.response.noContent()
  }

  /**
   * The acting member's row and the target's, locked and re-read inside the
   * transaction, so the role rules see a transfer or a departure that landed
   * meanwhile. Either one gone answers 404.
   */
  private async lockPair(
    trx: TransactionClientContract,
    ctx: HttpContext,
    target: TripMember
  ): Promise<{ actor: TripMember; fresh: TripMember }> {
    const rows = await this.memberships.lockLive(trx, ctx.trip.id, {
      ids: [ctx.membership.id, target.id],
    })
    const actor = rows.find((row) => row.id === ctx.membership.id)
    const fresh = rows.find((row) => row.id === target.id)
    if (!actor || !fresh) throw new ApiException('E_ROW_NOT_FOUND')
    return { actor, fresh }
  }

  private async findMember(ctx: HttpContext): Promise<TripMember> {
    const { id } = ctx.params as { id: string }
    const member = await TripMember.query()
      .where('id', id)
      .where('trip_id', ctx.trip.id)
      .whereNull('deleted_at')
      .preload('user')
      .first()
    if (!member) throw new ApiException('E_ROW_NOT_FOUND')
    return member
  }
}
