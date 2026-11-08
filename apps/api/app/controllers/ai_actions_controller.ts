import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { AiAction, ApiEnvelope } from '@monkitrips/shared'
import { AiActionDecisions, type AcceptedAction } from '#services/assistant/ai_action_decisions'
import { BookingProposals } from '#services/assistant/extraction/booking_proposals'
import { reviseBookingValidator } from '#validators/booking_extraction'

/** The member's decision on a proposal of the assistant: only the account that asked for it decides. */
@inject()
export default class AiActionsController {
  constructor(
    private readonly decisions: AiActionDecisions,
    private readonly bookings: BookingProposals
  ) {}

  /** 200 with the accepted action and the sync results; 409 `E_AI_ACTION_CLOSED` or `E_AI_ACTION_STALE`. */
  async accept(ctx: HttpContext): Promise<ApiEnvelope<AcceptedAction>> {
    const user = ctx.auth.use('web').getUserOrFail()
    return {
      data: await this.decisions.accept(user, ctx.trip, String(ctx.params['id']), ctx.i18n),
    }
  }

  async reject(ctx: HttpContext): Promise<ApiEnvelope<{ action: AiAction }>> {
    const user = ctx.auth.use('web').getUserOrFail()
    return {
      data: { action: await this.decisions.reject(user, ctx.trip, String(ctx.params['id'])) },
    }
  }

  /** 200 with the proposal recomputed from the member's corrected draft (an `extract_booking` only). */
  async revise(ctx: HttpContext): Promise<ApiEnvelope<AiAction>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const { draft } = await ctx.request.validateUsing(reviseBookingValidator)
    return {
      data: await this.bookings.revise(user, ctx.trip, ctx.i18n, String(ctx.params['id']), draft),
    }
  }
}
