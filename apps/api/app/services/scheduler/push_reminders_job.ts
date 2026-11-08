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
 * Every minute: for each active account with at least one push
 * subscription, plan its reminders (`UserReminders`) and send the ones due
 * in `(now − 15 min, now]`. Each is recorded in `sent_reminders` first and
 * sent only when this worker's insert won (`SentReminderLedger`), on top of
 * the slot claim the scheduler already makes. Without VAPID keys it does
 * nothing. Gone endpoints are pruned by `PushNotifications`, as for the
 * test push.
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
    let sent = 0
    for (const user of users) {
      try {
        sent += await this.runFor(user, since, nowMs, now)
      } catch (error) {
        logger.error({ err: error, job: this.name, userId: user.id }, 'reminders failed for a user')
      }
    }
    if (sent > 0) logger.info({ job: this.name, sent }, 'reminders sent')
  }

  private async runFor(user: User, since: Date, nowMs: number, now: Date): Promise<number> {
    // Planning from `since` includes the reminders that fell due since then.
    const planned = await this.reminders.plan(user, since)
    const due = planned.filter((reminder) => this.isDue(reminder, since.getTime(), nowMs))
    let sent = 0
    for (const reminder of due) {
      if (!(await this.ledger.claim(user.id, reminder, now))) continue
      await this.notifications.sendToUser(user, this.messages.reminder(user.locale, reminder))
      sent += 1
    }
    return sent
  }

  private isDue(reminder: PlannedReminder, sinceMs: number, nowMs: number): boolean {
    const fireMs = Date.parse(reminder.fireAt)
    return fireMs > sinceMs && fireMs <= nowMs
  }
}
