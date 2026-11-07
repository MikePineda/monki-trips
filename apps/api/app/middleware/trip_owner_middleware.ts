import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { canManageTrip } from '#domain/trip_roles'
import { ApiException } from '#exceptions/api_exception'

/** Owner-only routes: a member who is not the owner gets 403 `E_TRIP_ROLE` (they know the trip exists). Runs after `tripMember`. */
export default class TripOwnerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!canManageTrip(ctx.membership.role)) {
      throw new ApiException('E_TRIP_ROLE')
    }
    return next()
  }
}
