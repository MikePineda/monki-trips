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
import type User from '#models/user'
import { Clock } from '#services/clock'
import { TripCreation } from '#services/trip_creation'
import { TripMembership } from '#services/trip_membership'
import { TripSnapshot } from '#services/trip_snapshot'
import { ApiException } from '#exceptions/api_exception'
import { isUniqueViolation } from '#exceptions/unique_violation'
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
      const existing = await this.existingTrip(user, body.id)
      if (existing) return { data: toTripWire(existing) }
    }
    try {
      const { trip, created } = await this.creation.createOrFind(user, body)
      if (!created) return { data: toTripWire((await this.existingTrip(user, trip.id))!) }
      ctx.response.status(201)
      return { data: toTripWire(trip) }
    } catch (error) {
      // The same id posted twice at once: the request that lost the insert answers like a retry.
      if (!body.id || !isUniqueViolation(error, 'trips_pkey')) throw error
      const existing = await this.existingTrip(user, body.id)
      if (!existing) throw error
      return { data: toTripWire(existing) }
    }
  }

  /** The trip behind a client id, if the person is a member; 404 when it is someone else's. */
  private async existingTrip(user: User, id: string): Promise<Trip | null> {
    const existing = await Trip.find(id)
    if (!existing) return null
    const membership = await this.memberships.find(user, existing.id)
    if (!membership) throw new ApiException('E_ROW_NOT_FOUND')
    return existing
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

  /**
   * Brings the trip back. Its live memberships are re-stamped in the same
   * transaction: their clients dropped the trip while it was deleted, and a
   * membership newer than a pull cursor makes the next pull deliver the
   * whole trip again (see `SyncPull`).
   */
  async restore(ctx: HttpContext): Promise<ApiEnvelope<TripWire>> {
    await db.transaction(async (trx) => {
      ctx.trip.useTransaction(trx)
      ctx.trip.deletedAt = null
      ctx.trip.purgeAfter = null
      ctx.trip.updatedBy = ctx.membership.userId
      await ctx.trip.save()
      // A no-op assignment still fires the `sync_stamp()` trigger.
      await trx
        .from('trip_members')
        .where('trip_id', ctx.trip.id)
        .whereNull('deleted_at')
        .update({ joined_at: trx.raw('joined_at') })
    })
    return { data: toTripWire(ctx.trip) }
  }

  /**
   * Swaps the owner role with another live member in one transaction (the
   * one-owner index holds throughout). Both rows are locked and re-read
   * inside it, so a target who left meanwhile answers 404 `E_NOT_A_MEMBER`.
   */
  async transferOwnership(ctx: HttpContext): Promise<ApiEnvelope<TripMemberWire[]>> {
    const { userId } = await ctx.request.validateUsing(transferOwnershipValidator)
    const actorId = ctx.membership.id
    await db.transaction(async (trx) => {
      const rows = await this.memberships.lockLive(trx, ctx.trip.id, {
        ids: [actorId],
        userIds: [userId],
      })
      const actor = rows.find((row) => row.id === actorId)
      const target = rows.find((row) => row.userId === userId)
      if (!actor) throw new ApiException('E_ROW_NOT_FOUND')
      if (actor.role !== 'owner') throw new ApiException('E_TRIP_ROLE')
      if (!target) throw new ApiException('E_NOT_A_MEMBER')
      if (target.id === actor.id) return
      actor.role = 'editor'
      actor.updatedBy = actor.userId
      await actor.save()
      target.role = 'owner'
      target.updatedBy = actor.userId
      await target.save()
    })
    const members = await this.memberships.membersOf(ctx.trip.id)
    return { data: members.map(toTripMemberWire) }
  }
}
