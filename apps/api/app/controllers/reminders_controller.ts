import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, UpcomingReminder } from '@monkitrips/shared'
import { Clock } from '#services/clock'
import { PushMessages } from '#services/push_messages'
import { UserReminders } from '#services/user_reminders'

/**
 * `GET /me/reminders/upcoming`: what the `push:reminders` job will send the
 * signed-in account in the next 36 hours, rendered in its locale. Works
 * without a push subscription (Settings shows it as a preview).
 */
@inject()
export default class RemindersController {
  constructor(
    private readonly reminders: UserReminders,
    private readonly messages: PushMessages,
    private readonly clock: Clock
  ) {}

  async upcoming(ctx: HttpContext): Promise<ApiEnvelope<UpcomingReminder[]>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const planned = await this.reminders.plan(user, this.clock.now())
    return {
      data: planned.map((reminder) => {
        const payload = this.messages.reminder(user.locale, reminder)
        return {
          kind: reminder.kind,
          tripId: reminder.tripId,
          refId: reminder.refId,
          fireAt: reminder.fireAt,
          title: payload.title,
          body: payload.body,
          url: reminder.url,
        }
      }),
    }
  }
}
