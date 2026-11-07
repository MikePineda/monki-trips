/**
 * The connection indicator shown in the shell header, derived from what the
 * offline core knows. Pure: the caller passes `now`.
 *
 * Priority (first match wins): `failed` ("1 expense needs attention") >
 * `offline` ("Offline · everything saved") > `syncing` ("Syncing 3…") >
 * `pending` ("3 pending") > `stale` ("Data from 2 days ago", older than 24 h)
 * > `synced` (hidden).
 */
export type ConnectionState = 'failed' | 'offline' | 'syncing' | 'pending' | 'stale' | 'synced'

export interface ConnectionInputs {
  online: boolean
  /** A push or pull is in flight. */
  syncing: boolean
  /** Outbox entries in `pending` or `syncing`. */
  pendingCount: number
  /** Outbox entries in `failed`. */
  failedCount: number
  /** ISO timestamp of the last successful pull, null when never pulled. */
  lastPullAt: string | null
  now: Date
}

export interface ConnectionStatus {
  state: ConnectionState
  /**
   * What the copy counts: failed or queued mutations, or whole days since
   * the last pull when `stale`; 0 when there is nothing to count.
   */
  count: number
}

/** Data older than this is shown as stale. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export function deriveConnectionStatus(inputs: ConnectionInputs): ConnectionStatus {
  if (inputs.failedCount > 0) {
    return { state: 'failed', count: inputs.failedCount }
  }
  if (!inputs.online) {
    return { state: 'offline', count: inputs.pendingCount }
  }
  if (inputs.syncing) {
    return { state: 'syncing', count: inputs.pendingCount }
  }
  if (inputs.pendingCount > 0) {
    return { state: 'pending', count: inputs.pendingCount }
  }
  const age = inputs.lastPullAt ? inputs.now.getTime() - Date.parse(inputs.lastPullAt) : 0
  if (age > STALE_AFTER_MS) {
    return { state: 'stale', count: Math.floor(age / STALE_AFTER_MS) }
  }
  return { state: 'synced', count: 0 }
}
