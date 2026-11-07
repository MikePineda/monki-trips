import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type Trip from '#models/trip'
import type TripMember from '#models/trip_member'
import { TripMembership } from '#services/trip_membership'
import { ApiException } from '#exceptions/api_exception'

/**
 * The tenant boundary. Loads `:tripId` through the person's live membership
 * and shares `ctx.trip` and `ctx.membership`; a trip they do not belong to,
 * or one that is soft-deleted (unless the route allows it, e.g. restore),
 * answers 404 `E_ROW_NOT_FOUND`, never 403.
 */
@inject()
export default class TripMemberMiddleware {
  constructor(private readonly memberships: TripMembership) {}

  async handle(ctx: HttpContext, next: NextFn, options: { allowDeleted?: boolean } = {}) {
    const user = ctx.auth.use('web').getUserOrFail()
    const { tripId } = ctx.params as { tripId: string }
    const membership = await this.memberships.find(user, tripId)
    if (!membership || (membership.trip.deletedAt && !options.allowDeleted)) {
      throw new ApiException('E_ROW_NOT_FOUND')
    }
    ctx.membership = membership
    ctx.trip = membership.trip
    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    /** The trip of `:tripId`, present after `tripMember`. */
    trip: Trip
    /** The signed-in person's membership in `ctx.trip`. */
    membership: TripMember
  }
}
