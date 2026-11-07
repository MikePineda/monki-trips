import { Injectable, Injector, inject, type Signal } from '@angular/core'
import { OFFLINE_DB } from './db'
import { liveSignal } from './live'

/** Known meta keys. */
export const META_CURSOR = 'sync.cursor'
export const META_LAST_PULL_AT = 'sync.lastPullAt'
export const META_SESSION = 'session'
export const META_APP_VERSION = 'app.version'
export const META_ACTIVE_TRIP = 'trip.active'
export const META_LAST_OFFLINE_BOOT_AT = 'offline.lastBootAt'

/** Small key/value facts the device keeps about itself, in the `meta` table. */
@Injectable({ providedIn: 'root' })
export class MetaStore {
  private readonly db = inject(OFFLINE_DB)
  private readonly injector = inject(Injector)

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.db.meta.get(key))?.value as T | undefined
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.db.meta.put({ key, value })
  }

  async remove(key: string): Promise<void> {
    await this.db.meta.delete(key)
  }

  /**
   * A signal that follows `key`; `initial` until it loads and while the key
   * is absent. Each call opens a live query that lives as long as the app:
   * call it once (in a field), never inside a computed.
   */
  watch<T>(key: string, initial: T): Signal<T> {
    return liveSignal(
      async () => {
        const record = await this.db.meta.get(key)
        return record ? (record.value as T) : initial
      },
      initial,
      { injector: this.injector }
    )
  }
}
