import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, PushSubscription as PushSubscriptionWire } from '@monkitrips/shared'
import PushSubscription from '#models/push_subscription'
import { ApiException } from '#exceptions/api_exception'
import { toPushSubscriptionWire } from '#transformers/push_subscription_wire'
import { registerPushSubscriptionValidator } from '#validators/push_subscription'

/**
 * A browser's push subscription, private to the signed-in account. The
 * endpoint identifies the browser: registering it again (or from another
 * account on the same device) updates the existing row.
 */
export default class PushSubscriptionsController {
  async store(ctx: HttpContext): Promise<ApiEnvelope<PushSubscriptionWire>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const body = await ctx.request.validateUsing(registerPushSubscriptionValidator)
    const subscription = await PushSubscription.updateOrCreate(
      { endpoint: body.endpoint },
      {
        userId: user.id,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        deviceLabel: body.deviceLabel ?? null,
        failures: 0,
      }
    )
    ctx.response.status(subscription.$isLocal ? 201 : 200)
    return { data: toPushSubscriptionWire(subscription) }
  }

  async destroy(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    const subscription = await PushSubscription.query()
      .where('id', ctx.params.id)
      .where('user_id', user.id)
      .first()
    if (!subscription) throw new ApiException('E_ROW_NOT_FOUND')
    await subscription.delete()
    return ctx.response.noContent()
  }
}
