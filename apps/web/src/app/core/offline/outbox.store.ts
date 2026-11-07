import { Injectable, Injector, inject } from '@angular/core'
import { v7 as uuidv7 } from 'uuid'
import { transition, type OutboxEvent } from '../../domain/outbox-transition'
import { backoffMs } from '../../domain/sync-backoff'
import { CLOCK } from './clock'
import { OFFLINE_DB } from './offline-db'
import type { MonkiTripsDb } from './db'
import { liveSignal } from './live'
import type { OutboxRecord } from './records'

export interface OutboxEntryInput {
  tripId: string
  kind: string
  payload: unknown
}

/**
 * The FIFO queue of local mutations waiting for the server. Every state
 * move goes through the domain state machine; a failed entry stays until
 * the user retries or discards it, it is never removed silently.
 */
@Injectable({ providedIn: 'root' })
export class OutboxStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly clock = inject(CLOCK)
  private readonly injector = inject(Injector)

  /** Entries not yet accepted nor failed (`pending` or `syncing`). */
  readonly pendingCount = liveSignal(
    (db) => db.outbox.where('state').anyOf('pending', 'syncing').count(),
    0,
    { injector: this.injector }
  )

  readonly failedCount = liveSignal((db) => db.outbox.where('state').equals('failed').count(), 0, {
    injector: this.injector,
  })

  /** Failed entries, oldest first, for the "Pending" sheet. */
  readonly failed = liveSignal(
    async (db) => fifo(await db.outbox.where('state').equals('failed').toArray()),
    [] as OutboxRecord[],
    { injector: this.injector }
  )

  /**
   * Every entry that has not reached the server (pending, syncing or
   * failed), counted now: for decisions taken on a click, where a live
   * signal may not have caught up yet.
   */
  async unsentCount(): Promise<number> {
    const db = await this.database
    return db.outbox.where('state').anyOf('pending', 'syncing', 'failed').count()
  }

  async enqueue(input: OutboxEntryInput): Promise<OutboxRecord> {
    const record: OutboxRecord = {
      id: uuidv7(),
      tripId: input.tripId,
      kind: input.kind,
      payload: input.payload,
      state: 'pending',
      attempts: 0,
      createdAt: this.clock(),
      nextAttemptAt: null,
      error: null,
    }
    const db = await this.database
    await db.outbox.add(record)
    return record
  }

  /** The oldest pending entry whose backoff has elapsed. */
  async nextToSend(): Promise<OutboxRecord | undefined> {
    const now = Date.parse(this.clock())
    const db = await this.database
    const ready = await db.outbox
      .where('state')
      .equals('pending')
      .filter((entry) => entry.nextAttemptAt === null || Date.parse(entry.nextAttemptAt) <= now)
      .toArray()
    return fifo(ready)[0]
  }

  markSyncing(id: string): Promise<void> {
    return this.move(id, 'send')
  }

  /** The server applied it: the entry leaves the outbox. */
  acknowledge(id: string): Promise<void> {
    return this.move(id, 'acknowledged')
  }

  /** The server refused it (4xx): kept as failed with the server's message. */
  reject(id: string, message: string): Promise<void> {
    return this.move(id, 'rejected', { error: message })
  }

  /** No answer (network error, 5xx): back to pending after a backoff. */
  scheduleRetry(id: string): Promise<void> {
    return this.move(id, 'reset', (entry) => ({
      attempts: entry.attempts + 1,
      nextAttemptAt: new Date(Date.parse(this.clock()) + backoffMs(entry.attempts)).toISOString(),
    }))
  }

  /** User action on a failed entry: send it again now, attempts start over. */
  retry(id: string): Promise<void> {
    return this.move(id, 'retry', { attempts: 0, nextAttemptAt: null, error: null })
  }

  /** User action on a failed entry: drop it. */
  discard(id: string): Promise<void> {
    return this.move(id, 'discard')
  }

  /** Boot: entries left `syncing` by a crash go back to pending. */
  async resetSyncing(): Promise<void> {
    const db = await this.database
    await db.transaction('rw', db.outbox, async () => {
      const caught = await db.outbox.where('state').equals('syncing').toArray()
      for (const entry of caught) {
        await this.applyMove(db, entry, 'reset', {})
      }
    })
  }

  private async move(
    id: string,
    event: OutboxEvent,
    changes: Partial<OutboxRecord> | ((entry: OutboxRecord) => Partial<OutboxRecord>) = {}
  ): Promise<void> {
    const db = await this.database
    await db.transaction('rw', db.outbox, async () => {
      const entry = await db.outbox.get(id)
      if (!entry) {
        throw new Error(`Outbox entry not found: ${id}`)
      }
      await this.applyMove(
        db,
        entry,
        event,
        typeof changes === 'function' ? changes(entry) : changes
      )
    })
  }

  private async applyMove(
    db: MonkiTripsDb,
    entry: OutboxRecord,
    event: OutboxEvent,
    changes: Partial<OutboxRecord>
  ): Promise<void> {
    const next = transition(entry.state, event)
    if ('removed' in next) {
      await db.outbox.delete(entry.id)
    } else {
      await db.outbox.put({ ...entry, ...changes, state: next.state })
    }
  }
}

/** Oldest first; UUIDv7 ids break ties within the same instant. */
function fifo(entries: OutboxRecord[]): OutboxRecord[] {
  return [...entries].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  )
}
