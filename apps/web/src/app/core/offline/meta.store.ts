import { Injectable, Injector, inject, type Signal } from '@angular/core'
import { OFFLINE_DB } from './offline-db'
import { liveSignal } from './live'

/** Known meta keys. */
export const META_CURSOR = 'sync.cursor'
export const META_LAST_PULL_AT = 'sync.lastPullAt'
/** The mapped sync entities the stored cursor was built with (`syncedEntitiesKey`). */
export const META_SYNCED_ENTITIES = 'sync.entities'
export const META_SESSION = 'session'
export const META_APP_VERSION = 'app.version'
export const META_ACTIVE_TRIP = 'trip.active'
export const META_LAST_OFFLINE_BOOT_AT = 'offline.lastBootAt'
/** Id of the account whose data the device holds (trips, cursor, outbox). */
export const META_DEVICE_USER = 'device.userId'

/**
 * Facts about the device itself: they survive a change of account. Every
 * other key belongs to the person and goes with their data.
 */
export const DEVICE_META_KEYS: readonly string[] = [META_APP_VERSION, META_LAST_OFFLINE_BOOT_AT]

/** Small key/value facts the device keeps about itself, in the `meta` table. */
@Injectable({ providedIn: 'root' })
export class MetaStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly injector = inject(Injector)

  async get<T>(key: string): Promise<T | undefined> {
    const db = await this.database
    return (await db.meta.get(key))?.value as T | undefined
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.database
    await db.meta.put({ key, value })
  }

  async remove(key: string): Promise<void> {
    const db = await this.database
    await db.meta.delete(key)
  }

  /**
   * A signal that follows `key`; `initial` until it loads and while the key
   * is absent. Each call opens a live query that lives as long as the app:
   * call it once (in a field), never inside a computed.
   */
  watch<T>(key: string, initial: T): Signal<T> {
    return liveSignal(
      async (db) => {
        const record = await db.meta.get(key)
        return record ? (record.value as T) : initial
      },
      initial,
      { injector: this.injector }
    )
  }
}
