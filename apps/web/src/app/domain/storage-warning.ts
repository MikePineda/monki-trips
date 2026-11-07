/**
 * The storage warning of "Save offline": `navigator.storage.estimate()`
 * says how much the origin uses and may use; the copies the device keeps
 * (plus the one about to land) should stay under half of what is free, so
 * the browser is never tempted to evict them. Pure.
 */
export interface StorageEstimateLike {
  usage: number
  quota: number
}

export interface StoragePressure {
  warning: boolean
  /** Bytes still free on the origin, null when the browser gave no estimate. */
  freeBytes: number | null
}

export function storagePressure(
  estimate: StorageEstimateLike | null,
  copiesBytes: number
): StoragePressure {
  if (!estimate) {
    return { warning: false, freeBytes: null }
  }
  const freeBytes = Math.max(0, estimate.quota - estimate.usage)
  return { warning: copiesBytes > freeBytes / 2, freeBytes }
}
