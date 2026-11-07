import type { OutboxRecord, SyncChange } from '../app/core/offline/records'
import type { SyncApi, SyncPullResult, SyncPushResult } from '../app/core/offline/sync-api'

export type SyncApiCall = { kind: 'pull'; cursor: string | null } | { kind: 'push'; ids: string[] }

/**
 * In-memory server for the offline specs. Pull answers the queued changes
 * (none by default) with cursor `fake-<n>`; push accepts everything except
 * what the knobs say.
 */
export class FakeSyncApi implements SyncApi {
  readonly calls: SyncApiCall[] = []
  private pulls = 0
  private pullError: unknown = null
  private pushError: unknown = null
  private pendingChanges: SyncChange[] = []
  private pendingTripIds: string[] | undefined
  private readonly rejections = new Map<string, string>()
  private readonly conflicts = new Map<string, SyncChange>()

  /** The next pull answers these changes. */
  queuePullChanges(...changes: SyncChange[]): void {
    this.pendingChanges.push(...changes)
  }

  /** The next pull names these trips as the account's (any other is dropped). */
  queuePullTripIds(tripIds: string[]): void {
    this.pendingTripIds = tripIds
  }

  /** The next pull throws `error`, as a network failure would. */
  failNextPullWith(error: unknown): void {
    this.pullError = error
  }

  /** The next push throws `error`, as a network failure or a 5xx would. */
  failNextPushWith(error: unknown): void {
    this.pushError = error
  }

  /** The next push of mutation `id` is rejected with `message`. */
  rejectNext(id: string, message: string): void {
    this.rejections.set(id, message)
  }

  /** The next push of mutation `id` conflicts; the server answers `serverRow`. */
  conflictNext(id: string, serverRow: SyncChange): void {
    this.conflicts.set(id, serverRow)
  }

  /** Ids of every pushed mutation, in order. */
  pushedIds(): string[] {
    return this.calls.flatMap((call) => (call.kind === 'push' ? call.ids : []))
  }

  async pull(cursor: string | null): Promise<SyncPullResult> {
    this.calls.push({ kind: 'pull', cursor })
    if (this.pullError !== null) {
      const error = this.pullError
      this.pullError = null
      throw error
    }
    this.pulls += 1
    const changes = this.pendingChanges
    const tripIds = this.pendingTripIds
    this.pendingChanges = []
    this.pendingTripIds = undefined
    return { cursor: `fake-${this.pulls}`, changes, ...(tripIds ? { tripIds } : {}) }
  }

  async push(mutations: OutboxRecord[]): Promise<SyncPushResult> {
    this.calls.push({ kind: 'push', ids: mutations.map((mutation) => mutation.id) })
    if (this.pushError !== null) {
      const error = this.pushError
      this.pushError = null
      throw error
    }
    const result: SyncPushResult = { accepted: [], rejected: [], conflicts: [] }
    for (const { id } of mutations) {
      const message = this.rejections.get(id)
      const serverRow = this.conflicts.get(id)
      if (message !== undefined) {
        this.rejections.delete(id)
        result.rejected.push({ id, message })
      } else if (serverRow) {
        this.conflicts.delete(id)
        result.conflicts.push({ id, serverRow })
      } else {
        result.accepted.push(id)
      }
    }
    return result
  }
}
