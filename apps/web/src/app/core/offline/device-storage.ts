import { DOCUMENT, inject, InjectionToken } from '@angular/core'

export interface StorageEstimateBytes {
  usage: number
  quota: number
}

/**
 * The browser's storage manager (`navigator.storage`), behind a token so
 * specs can say what the quota is. `persist()` asks the browser not to
 * evict the origin's data; every call answers false or null where the
 * browser has no storage manager.
 */
export interface DeviceStorage {
  persist(): Promise<boolean>
  persisted(): Promise<boolean>
  estimate(): Promise<StorageEstimateBytes | null>
}

export const DEVICE_STORAGE = new InjectionToken<DeviceStorage>('DEVICE_STORAGE', {
  providedIn: 'root',
  factory: () => {
    const manager = inject(DOCUMENT).defaultView?.navigator.storage
    return {
      persist: async () => (manager?.persist ? manager.persist() : false),
      persisted: async () => (manager?.persisted ? manager.persisted() : false),
      estimate: async () => {
        if (!manager?.estimate) {
          return null
        }
        const estimate = await manager.estimate()
        return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
      },
    }
  },
})
