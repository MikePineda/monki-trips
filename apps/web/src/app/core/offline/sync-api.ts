import { inject, InjectionToken } from '@angular/core'
import { API } from '../api/api'
import { RealSyncApi } from '../api/real-sync-api'
import type { ExpenseShareRecord, OutboxRecord, SyncChange } from './records'

export interface SyncPullResult {
  /** Opaque position to send back on the next pull. */
  cursor: string
  changes: SyncChange[]
  /** Every trip the account belongs to; the device drops any other. Absent = unknown. */
  tripIds?: string[]
  /** More pages follow from `cursor`. */
  hasMore?: boolean
}

export interface SyncPushResult {
  /** Mutation ids the server applied (or had already applied). */
  accepted: string[]
  /** 4xx semantics: the server refuses the mutation and says why. */
  rejected: { id: string; message: string }[]
  /** The server's row wins; the client applies it and drops the mutation. */
  conflicts: { id: string; serverRow: SyncChange }[]
  /**
   * For each pushed expense, the live shares the server keeps after the
   * mutation (applied or not): the device replaces its own with these.
   */
  expenseShares?: { expenseId: string; shares: ExpenseShareRecord[] }[]
}

/**
 * The server no longer knows the cursor (410): the device clears its copy,
 * keeps the outbox and pulls everything again.
 */
export class SyncCursorExpired extends Error {
  constructor() {
    super('The sync cursor has expired')
    this.name = 'SyncCursorExpired'
  }
}

/**
 * The server side of sync. A thrown error means "no answer" (network error
 * or 5xx): the mutation is retried with backoff. A pull may throw
 * `SyncCursorExpired`.
 */
export interface SyncApi {
  pull(cursor: string | null): Promise<SyncPullResult>
  push(mutations: OutboxRecord[]): Promise<SyncPushResult>
}

export const SYNC_API = new InjectionToken<SyncApi>('SYNC_API', {
  providedIn: 'root',
  factory: () => new RealSyncApi(inject(API)),
})
