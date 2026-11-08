import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, NotificationSettings } from '@monkitrips/shared'
import { Clock } from '#services/clock'
import { NotificationSettingsStore } from '#services/notification_settings_store'
import { notificationSettingsValidator } from '#validators/notification_settings'

/** Which reminders the signed-in account gets, and its quiet hours. Private to the account. */
@inject()
export default class NotificationSettingsController {
  constructor(
    private readonly store: NotificationSettingsStore,
    private readonly clock: Clock
  ) {}

  async show(ctx: HttpContext): Promise<ApiEnvelope<NotificationSettings>> {
    const user = ctx.auth.use('web').getUserOrFail()
    return { data: await this.store.forUser(user.id) }
  }

  async update(ctx: HttpContext): Promise<ApiEnvelope<NotificationSettings>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const body = await ctx.request.validateUsing(notificationSettingsValidator)
    return { data: await this.store.save(user.id, body, this.clock.now()) }
  }
}
