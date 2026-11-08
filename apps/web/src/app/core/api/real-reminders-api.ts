import type { NotificationSettings, UpcomingReminder } from '@monkitrips/shared'
import type { ApiClientLoader } from './api'
import { apiCall } from './api-failure'
import type { RemindersApi } from './reminders-api'

/** `RemindersApi` over the typed client. */
export class RealRemindersApi implements RemindersApi {
  constructor(private readonly client: ApiClientLoader) {}

  async settings(): Promise<NotificationSettings> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('me.notificationSettings.show', {}))
    return data
  }

  async saveSettings(settings: NotificationSettings): Promise<NotificationSettings> {
    const api = await this.client()
    const { data } = await apiCall(() =>
      api.request('me.notificationSettings.update', { body: settings })
    )
    return data
  }

  async upcoming(): Promise<UpcomingReminder[]> {
    const api = await this.client()
    const { data } = await apiCall(() => api.request('me.reminders.upcoming', {}))
    return data
  }
}
