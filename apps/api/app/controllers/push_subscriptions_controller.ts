import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type {
  ApiEnvelope,
  PushSubscription as PushSubscriptionWire,
  PushTestResult,
} from '@monkitrips/shared'
import PushSubscription from '#models/push_subscription'
import { ApiException } from '#exceptions/api_exception'
import { PushMessages } from '#services/push_messages'
import { PushNotifications } from '#services/push_notifications'
import { VapidConfig } from '#services/vapid_config'
import { toPushSubscriptionWire } from '#transformers/push_subscription_wire'
import { registerPushSubscriptionValidator } from '#validators/push_subscription'

/**
 * A browser's push subscription, private to the signed-in account. The
 * endpoint identifies the browser: registering it again (or from another
 * account on the same device) updates the existing row. `test` sends the
 * "notifications work" message to every subscription of the caller.
 */
@inject()
export default class PushSubscriptionsController {
  constructor(
    private readonly vapid: VapidConfig,
    private readonly notifications: PushNotifications,
    private readonly messages: PushMessages
  ) {}

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
    const { id } = ctx.params as { id: string }
    const subscription = await PushSubscription.query()
      .where('id', id)
      .where('user_id', user.id)
      .first()
    if (!subscription) throw new ApiException('E_ROW_NOT_FOUND')
    await subscription.delete()
    return ctx.response.noContent()
  }

  async test(ctx: HttpContext): Promise<ApiEnvelope<PushTestResult>> {
    const user = ctx.auth.use('web').getUserOrFail()
    if (!this.vapid.enabled) throw new ApiException('E_PUSH_DISABLED')
    const result = await this.notifications.sendToUser(user, this.messages.test(user.locale))
    return { data: result }
  }
}
