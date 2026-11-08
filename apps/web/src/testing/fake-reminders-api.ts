import {
  DEFAULT_REMINDER_SETTINGS,
  type NotificationSettings,
  type UpcomingReminder,
} from '@monkitrips/shared'
import type { RemindersApi } from '../app/core/api/reminders-api'
import { FakeApi } from './fake-api'

/**
 * In-memory stand-in: keeps the saved settings and answers `upcoming` with
 * the scripted list, minus the kinds the settings turned off (like the
 * server, which plans only the enabled kinds).
 */
export class FakeRemindersApi extends FakeApi implements RemindersApi {
  saved: NotificationSettings = { ...DEFAULT_REMINDER_SETTINGS }
  /** Every body `saveSettings` received, in order. */
  readonly savedBodies: NotificationSettings[] = []
  reminders: UpcomingReminder[] = []

  settings(): Promise<NotificationSettings> {
    return this.run('settings', () => ({ ...this.saved }))
  }

  saveSettings(settings: NotificationSettings): Promise<NotificationSettings> {
    return this.run('saveSettings', () => {
      this.savedBodies.push({ ...settings })
      this.saved = { ...settings }
      return { ...settings }
    })
  }

  upcoming(): Promise<UpcomingReminder[]> {
    return this.run('upcoming', () =>
      this.reminders.filter(
        (reminder) =>
          (reminder.kind === 'leave_at' && this.saved.leaveAt) ||
          (reminder.kind === 'check_out' && this.saved.checkOut) ||
          (reminder.kind === 'tasks_due' && this.saved.tasksDue)
      )
    )
  }
}
