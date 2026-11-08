import db from '@adonisjs/lucid/services/db'
import { DEFAULT_REMINDER_SETTINGS, type NotificationSettings } from '@monkitrips/shared'

interface SettingsRow {
  leave_at: boolean
  check_out: boolean
  tasks_due: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

/**
 * Reads and writes `notification_settings`, one row per account. An
 * account without a row has `DEFAULT_REMINDER_SETTINGS`; saving upserts.
 */
export class NotificationSettingsStore {
  async forUser(userId: string): Promise<NotificationSettings> {
    const row = (await db
      .from('notification_settings')
      .where('user_id', userId)
      .first()) as SettingsRow | null
    if (!row) return { ...DEFAULT_REMINDER_SETTINGS }
    return {
      leaveAt: row.leave_at,
      checkOut: row.check_out,
      tasksDue: row.tasks_due,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
    }
  }

  async save(
    userId: string,
    settings: NotificationSettings,
    now: Date
  ): Promise<NotificationSettings> {
    await db
      .table('notification_settings')
      .insert({
        user_id: userId,
        leave_at: settings.leaveAt,
        check_out: settings.checkOut,
        tasks_due: settings.tasksDue,
        quiet_hours_start: settings.quietHoursStart,
        quiet_hours_end: settings.quietHoursEnd,
        updated_at: now.toISOString(),
      })
      .onConflict('user_id')
      .merge()
    return this.forUser(userId)
  }
}
