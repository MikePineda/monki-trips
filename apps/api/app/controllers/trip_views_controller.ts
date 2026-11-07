import vine from '@vinejs/vine'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, BudgetStatus, NightsView, TodayView } from '@monkitrips/shared'
import { TripViews } from '#services/trip_views'
import { instantField } from '#validators/sync/fields'

const todayQuery = vine.compile(vine.object({ at: instantField.optional() }))

/** The computed views of a trip: where we sleep, the budget position and Today. Members only. */
@inject()
export default class TripViewsController {
  constructor(private readonly views: TripViews) {}

  async nights(ctx: HttpContext): Promise<ApiEnvelope<NightsView>> {
    return { data: await this.views.nights(ctx.trip) }
  }

  async budget(ctx: HttpContext): Promise<ApiEnvelope<BudgetStatus>> {
    return { data: await this.views.budget(ctx.trip) }
  }

  /** `?at=` names the instant to compute for (ISO); the clock otherwise. */
  async today(ctx: HttpContext): Promise<ApiEnvelope<TodayView>> {
    const { at } = await todayQuery.validate(ctx.request.qs(), {
      meta: undefined,
      messagesProvider: ctx.i18n.createMessagesProvider(),
    })
    return { data: await this.views.today(ctx.trip, at ? new Date(at) : undefined) }
  }
}
