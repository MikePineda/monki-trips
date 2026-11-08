import type { ReminderKind, ReminderSettings } from './domain/reminder_plan.ts'
import type { IsoInstant } from './domain/zoned_instant.ts'

/**
 * Body and answer of `GET`/`PUT /api/v1/me/notification-settings`: which
 * reminders the signed-in person gets and their quiet hours (local
 * `HH:MM`, both set or both null). An account that never saved any gets
 * `DEFAULT_REMINDER_SETTINGS`.
 */
export type NotificationSettings = ReminderSettings

/** One item of `GET /api/v1/me/reminders/upcoming`: a planned reminder, rendered in the caller's locale. */
export interface UpcomingReminder {
  kind: ReminderKind
  tripId: string
  refId: string
  fireAt: IsoInstant
  title: string
  body: string
  /** Path of the web app the notification opens. */
  url: string
}
