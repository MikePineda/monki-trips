import { Injectable, inject } from '@angular/core'
import { DEVICE_STORAGE } from '../offline/device-storage'

export interface StorageState {
  /** The browser promised not to evict the app's data under pressure. */
  persisted: boolean
  usageBytes: number
  quotaBytes: number
}

/**
 * The device's storage for the "Ready to fly" check, read through the
 * same storage manager the offline copies use (`DEVICE_STORAGE`): whether
 * it is persisted and how much room is left, plus the request to persist
 * it. A browser that refuses or has no storage manager answers "not
 * persisted, no room known".
 */
@Injectable({ providedIn: 'root' })
export class StorageProbe {
  private readonly storage = inject(DEVICE_STORAGE)

  async state(): Promise<StorageState> {
    const [persisted, estimate] = await Promise.all([
      this.storage.persisted().catch(() => false),
      this.storage.estimate().catch(() => null),
    ])
    return {
      persisted,
      usageBytes: estimate?.usage ?? 0,
      quotaBytes: estimate?.quota ?? 0,
    }
  }

  /**
   * Asks the browser to keep the data, unless it already does (the first
   * offline copy may have asked); answers whether it now does.
   */
  async persist(): Promise<boolean> {
    if (await this.storage.persisted().catch(() => false)) {
      return true
    }
    return this.storage.persist().catch(() => false)
  }
}
