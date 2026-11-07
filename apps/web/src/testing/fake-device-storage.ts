import type { DeviceStorage, StorageEstimateBytes } from '../app/core/offline/device-storage'

/** A storage manager whose estimate a spec sets; it counts `persist()` calls. */
export class FakeDeviceStorage implements DeviceStorage {
  estimateBytes: StorageEstimateBytes | null = { usage: 0, quota: 1024 * 1024 * 1024 }
  persistCalls = 0
  isPersisted = false

  async persist(): Promise<boolean> {
    this.persistCalls += 1
    this.isPersisted = true
    return true
  }

  async persisted(): Promise<boolean> {
    return this.isPersisted
  }

  async estimate(): Promise<StorageEstimateBytes | null> {
    return this.estimateBytes
  }
}
