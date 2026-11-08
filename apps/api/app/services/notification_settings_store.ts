import db from '@adonisjs/lucid/services/db'
import { DEFAULT_REMINDER_SETTINGS, type NotificationSettings } from '@monkitrips/shared'

interface SettingsRow {
  leave_at: boolean
  check_out: boolean
  tasks_due: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

function fromRow(row: SettingsRow): NotificationSettings {
  return {
    leaveAt: row.leave_at,
    checkOut: row.check_out,
    tasksDue: row.tasks_due,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
  }
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
    return row ? fromRow(row) : { ...DEFAULT_REMINDER_SETTINGS }
  }

  /** The settings of every account in `userIds`, in one query; defaults for those without a row. */
  async forUsers(userIds: readonly string[]): Promise<Map<string, NotificationSettings>> {
    const rows =
      userIds.length === 0
        ? []
        : ((await db
            .from('notification_settings')
            .whereIn('user_id', [...userIds])) as (SettingsRow & { user_id: string })[])
    const byUser = new Map(rows.map((row) => [row.user_id, fromRow(row)]))
    return new Map(userIds.map((id) => [id, byUser.get(id) ?? { ...DEFAULT_REMINDER_SETTINGS }]))
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
