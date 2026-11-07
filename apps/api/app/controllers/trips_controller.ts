import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { errors as vineErrors } from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import type {
  ApiEnvelope,
  Trip as TripWire,
  TripListItem,
  TripMember as TripMemberWire,
  TripSnapshot as TripSnapshotWire,
} from '@monkitrips/shared'
import Trip from '#models/trip'
import TripMember from '#models/trip_member'
import { Clock } from '#services/clock'
import { TripCreation } from '#services/trip_creation'
import { TripMembership } from '#services/trip_membership'
import { TripSnapshot } from '#services/trip_snapshot'
import { ApiException } from '#exceptions/api_exception'
import { tripPurgeDate } from '#domain/trip_lifecycle'
import { toTripListItem, toTripWire } from '#transformers/trip_wire'
import { toTripMemberWire } from '#transformers/trip_member_wire'
import { createTripValidator } from '#validators/trip'
import { transferOwnershipValidator } from '#validators/trip_member'

/** Trips of the signed-in person and the owner-only lifecycle of one trip. */
@inject()
export default class TripsController {
  constructor(
    private readonly clock: Clock,
    private readonly creation: TripCreation,
    private readonly memberships: TripMembership,
    private readonly snapshots: TripSnapshot
  ) {}

  /** Live trips the person belongs to, with their role and the member count. */
  async index(ctx: HttpContext): Promise<ApiEnvelope<TripListItem[]>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const memberships = await this.memberships.tripsOf(user)
    const counts = await this.memberships.memberCounts(memberships.map((m) => m.tripId))
    return {
      data: memberships.map((m) => toTripListItem(m.trip, m.role, counts.get(m.tripId) ?? 1)),
    }
  }

  /**
   * Creates a trip with the person as owner (and first traveller). With a
   * client `id` the call is idempotent: the same person posting the same id
   * again gets the existing trip; an id that belongs to someone else's trip
   * answers 404 like any trip they are not a member of.
   */
  async store(ctx: HttpContext): Promise<ApiEnvelope<TripWire>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const body = await ctx.request.validateUsing(createTripValidator)
    if (body.endsOn < body.startsOn) {
      throw new vineErrors.E_VALIDATION_ERROR([
        {
          field: 'endsOn',
          rule: 'afterOrEqual',
          message: ctx.i18n.t('validator.shared.messages.endsOn.afterOrEqual'),
        },
      ])
    }
    if (body.id) {
      const existing = await Trip.find(body.id)
      if (existing) {
        const membership = await this.memberships.find(user, existing.id)
        if (!membership) throw new ApiException('E_ROW_NOT_FOUND')
        return { data: toTripWire(existing) }
      }
    }
    const trip = await this.creation.create(user, body)
    ctx.response.status(201)
    return { data: toTripWire(trip) }
  }

  async snapshot(ctx: HttpContext): Promise<ApiEnvelope<TripSnapshotWire>> {
    return { data: await this.snapshots.build(ctx.trip) }
  }

  /** Soft delete, restorable for 30 days. */
  async destroy(ctx: HttpContext) {
    const now = this.clock.now()
    ctx.trip.deletedAt = DateTime.fromJSDate(now)
    ctx.trip.purgeAfter = DateTime.fromJSDate(tripPurgeDate(now))
    ctx.trip.updatedBy = ctx.membership.userId
    await ctx.trip.save()
    return ctx.response.noContent()
  }

  async restore(ctx: HttpContext): Promise<ApiEnvelope<TripWire>> {
    ctx.trip.deletedAt = null
    ctx.trip.purgeAfter = null
    ctx.trip.updatedBy = ctx.membership.userId
    await ctx.trip.save()
    return { data: toTripWire(ctx.trip) }
  }

  /** Swaps the owner role with another live member, in one transaction (the one-owner index holds throughout). */
  async transferOwnership(ctx: HttpContext): Promise<ApiEnvelope<TripMemberWire[]>> {
    const { userId } = await ctx.request.validateUsing(transferOwnershipValidator)
    const target = await TripMember.query()
      .where('trip_id', ctx.trip.id)
      .where('user_id', userId)
      .whereNull('deleted_at')
      .first()
    if (!target) throw new ApiException('E_NOT_A_MEMBER')
    if (target.id !== ctx.membership.id) {
      await db.transaction(async (trx) => {
        ctx.membership.useTransaction(trx)
        ctx.membership.role = 'editor'
        ctx.membership.updatedBy = ctx.membership.userId
        await ctx.membership.save()
        target.useTransaction(trx)
        target.role = 'owner'
        target.updatedBy = ctx.membership.userId
        await target.save()
      })
    }
    const members = await this.memberships.membersOf(ctx.trip.id)
    return { data: members.map(toTripMemberWire) }
  }
}
