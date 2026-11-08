import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { PlannedReminder } from '@monkitrips/shared'
import User from '#models/user'
import { PushMessages } from '#services/push_messages'
import { PushNotifications } from '#services/push_notifications'
import { SentReminderLedger } from '#services/sent_reminder_ledger'
import { UserReminders } from '#services/user_reminders'
import { VapidConfig } from '#services/vapid_config'
import type { ScheduledJob } from '#services/scheduler/scheduled_job'

/** A reminder up to this late (a missed tick, a restart) is still sent; older ones are skipped. */
export const REMINDER_LATE_TOLERANCE_MS = 15 * 60_000

/**
 * Every minute: plan, in one batch, the reminders of every active account
 * with at least one push subscription (`UserReminders.planFor`, a fixed
 * number of queries whatever the number of accounts) and send the ones due
 * in `(now − 15 min, now]`. Each is recorded in `sent_reminders` first and
 * sent only when this worker's insert won (`SentReminderLedger`), on top of
 * the slot claim the scheduler already makes. A send that reached no
 * device for a transient reason (5xx, 429, timeout, network) releases its
 * claim, so the next minute retries while the window lasts: at least once
 * within the window, at most once after a success. Without VAPID keys it
 * does nothing. Gone endpoints are pruned by `PushNotifications`, as for
 * the test push.
 */
@inject()
export class PushRemindersJob implements ScheduledJob {
  readonly name = 'push:reminders'
  readonly interval = 'minute' as const

  constructor(
    private readonly vapid: VapidConfig,
    private readonly reminders: UserReminders,
    private readonly ledger: SentReminderLedger,
    private readonly notifications: PushNotifications,
    private readonly messages: PushMessages
  ) {}

  async run(now: Date): Promise<void> {
    if (!this.vapid.enabled) return
    const nowMs = now.getTime()
    const since = new Date(nowMs - REMINDER_LATE_TOLERANCE_MS)
    const users = await User.query()
      .where('status', 'active')
      .whereNull('deletion_scheduled_at')
      .whereExists((query) => {
        query.from('push_subscriptions').whereColumn('push_subscriptions.user_id', 'users.id')
      })
      .orderBy('id')
    // Planning from `since` includes the reminders that fell due since then.
    const plans = await this.reminders.planFor(
      users.map((user) => user.id),
      since
    )
    let sent = 0
    for (const user of users) {
      const due = (plans.get(user.id) ?? []).filter((reminder) =>
        this.isDue(reminder, since.getTime(), nowMs)
      )
      try {
        sent += await this.send(user, due, now)
      } catch (error) {
        logger.error({ err: error, job: this.name, userId: user.id }, 'reminders failed for a user')
      }
    }
    if (sent > 0) logger.info({ job: this.name, sent }, 'reminders sent')
  }

  private async send(user: User, due: PlannedReminder[], now: Date): Promise<number> {
    let sent = 0
    for (const reminder of due) {
      if (!(await this.ledger.claim(user.id, reminder, now))) continue
      const report = await this.notifications.sendToUser(
        user,
        this.messages.reminder(user.locale, reminder)
      )
      if (report.sent === 0 && report.transient > 0) {
        await this.ledger.release(user.id, reminder)
        continue
      }
      sent += 1
    }
    return sent
  }

  private isDue(reminder: PlannedReminder, sinceMs: number, nowMs: number): boolean {
    const fireMs = Date.parse(reminder.fireAt)
    return fireMs > sinceMs && fireMs <= nowMs
  }
}
