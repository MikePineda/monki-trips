import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
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
    const decision = roleChange({
      actorRole: ctx.membership.role,
      targetRole: target.role,
      newRole: role,
    })
    if (decision !== 'allowed') throw new ApiException(decision)
    target.role = role
    target.updatedBy = ctx.membership.userId
    await target.save()
    return { data: toTripMemberWire(target) }
  }

  async destroy(ctx: HttpContext) {
    const target = await this.findMember(ctx)
    const decision = memberRemoval({
      actorRole: ctx.membership.role,
      targetRole: target.role,
      actorIsTarget: target.id === ctx.membership.id,
    })
    if (decision !== 'allowed') throw new ApiException(decision)
    target.deletedAt = DateTime.fromJSDate(this.clock.now())
    target.updatedBy = ctx.membership.userId
    await target.save()
    return ctx.response.noContent()
  }

  private async findMember(ctx: HttpContext): Promise<TripMember> {
    const member = await TripMember.query()
      .where('id', ctx.params.id)
      .where('trip_id', ctx.trip.id)
      .whereNull('deleted_at')
      .preload('user')
      .first()
    if (!member) throw new ApiException('E_ROW_NOT_FOUND')
    return member
  }
}
