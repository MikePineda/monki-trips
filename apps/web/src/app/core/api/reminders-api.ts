import { inject, InjectionToken } from '@angular/core'
import type { NotificationSettings, UpcomingReminder } from '@monkitrips/shared'
import { API } from './api'
import { RealRemindersApi } from './real-reminders-api'

/**
 * The signed-in person's push reminders: which kinds they get and their
 * quiet hours (account-wide, every device), and what the server plans to
 * send in the next 36 hours, already rendered in the account's language.
 */
export interface RemindersApi {
  settings(): Promise<NotificationSettings>
  saveSettings(settings: NotificationSettings): Promise<NotificationSettings>
  upcoming(): Promise<UpcomingReminder[]>
}

export const REMINDERS_API = new InjectionToken<RemindersApi>('REMINDERS_API', {
  providedIn: 'root',
  factory: () => new RealRemindersApi(inject(API)),
})
