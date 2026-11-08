import { Injectable, inject, signal } from '@angular/core'
import type { NotificationSettings, UpcomingReminder } from '@monkitrips/shared'
import { ApiFailure } from '../../core/api/api-failure'
import { REMINDERS_API } from '../../core/api/reminders-api'
import { MetaStore } from '../../core/offline/meta.store'
import { OnlineStore } from '../../core/offline/online.store'
import { SessionStore } from '../../core/session/session.store'

/** Meta keys: the last reminder settings and upcoming list the server answered. */
export const META_REMINDER_SETTINGS = 'reminders.settings'
export const META_UPCOMING_REMINDERS = 'reminders.upcoming'

/**
 * The account's reminder choices and what the server plans to send next,
 * for one Settings instance (provided by the component). Every answer is
 * kept on the device (Dexie `meta`, gone with the account's data), so
 * offline the section shows the last values read-only. A 401 while online
 * ends the session; any other failure is kept for the section to show next
 * to the saved values.
 */
@Injectable()
export class RemindersStore {
  private readonly api = inject(REMINDERS_API)
  private readonly meta = inject(MetaStore)
  private readonly online = inject(OnlineStore)
  private readonly session = inject(SessionStore)

  /** Null until the server or the device answered. */
  readonly settings = signal<NotificationSettings | null>(null)
  readonly upcoming = signal<UpcomingReminder[]>([])
  readonly saving = signal(false)
  readonly failure = signal<ApiFailure | null>(null)
  /** True once the first `load` finished (device copy read, server asked when online). */
  readonly ready = signal(false)

  /** The device's copy first, then (online) the server's, which replaces it. */
  async load(): Promise<void> {
    try {
      await this.loadOnce()
    } finally {
      this.ready.set(true)
    }
  }

  private async loadOnce(): Promise<void> {
    const [settings, upcoming] = await Promise.all([
      this.meta.get<NotificationSettings>(META_REMINDER_SETTINGS),
      this.meta.get<UpcomingReminder[]>(META_UPCOMING_REMINDERS),
    ])
    if (settings && this.settings() === null) this.settings.set(settings)
    if (upcoming && this.upcoming().length === 0) this.upcoming.set(upcoming)
    if (!this.online.online()) return
    await this.attempt(async () => {
      const [fresh, list] = await Promise.all([this.api.settings(), this.api.upcoming()])
      await this.keepSettings(fresh)
      await this.keepUpcoming(list)
    })
  }

  /** Saves the whole settings object; the upcoming list is planned again with it. True when saved. */
  async save(settings: NotificationSettings): Promise<boolean> {
    if (!this.online.online() || this.saving()) return false
    this.saving.set(true)
    try {
      return await this.attempt(async () => {
        await this.keepSettings(await this.api.saveSettings(settings))
        await this.keepUpcoming(await this.api.upcoming())
      })
    } finally {
      this.saving.set(false)
    }
  }

  private async attempt(work: () => Promise<void>): Promise<boolean> {
    try {
      await work()
      this.failure.set(null)
      return true
    } catch (error) {
      const failure = toFailure(error)
      if (!(await this.session.handleUnauthorized(failure))) {
        this.failure.set(failure)
      }
      return false
    }
  }

  private async keepSettings(settings: NotificationSettings): Promise<void> {
    this.settings.set(settings)
    await this.meta.set(META_REMINDER_SETTINGS, settings)
  }

  private async keepUpcoming(list: UpcomingReminder[]): Promise<void> {
    this.upcoming.set(list)
    await this.meta.set(META_UPCOMING_REMINDERS, list)
  }
}

function toFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ kind: 'network', message: String(error) })
}
