import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  InjectionToken,
  Injector,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import { CLOCK } from './clock'
import type { MonkiTripsDb } from './db'
import { META_CURSOR, META_LAST_PULL_AT, MetaStore } from './meta.store'
import { OnlineStore } from './online.store'
import { OFFLINE_DB } from './offline-db'
import { OutboxStore } from './outbox.store'
import { mergePendingRow } from './pending-merge'
import { SYNC_TABLES, type OutboxRecord, type SyncChange, type SyncTable } from './records'
import { SYNC_API, SyncCursorExpired, type SyncPushResult } from './sync-api'

/** What the sync loop tells the UI; the app wires it to the toast service. */
export interface SyncNotifier {
  /** A local change lost against the server's newer row (server wins). */
  conflictResolved(): void
}

export const SYNC_NOTIFIER = new InjectionToken<SyncNotifier>('SYNC_NOTIFIER', {
  providedIn: 'root',
  factory: () => ({
    conflictResolved: () => undefined,
  }),
})

/** Pull period while the app is visible. */
export const PULL_INTERVAL_MS = 5 * 60 * 1000

/** Tables scoped by `tripId` (everything but the trips themselves). */
const TRIP_SCOPED_TABLES: readonly SyncTable[] = SYNC_TABLES.filter((table) => table !== 'trips')

/**
 * Keeps Dexie and the server in step. Pull refills the local tables from
 * the stored cursor, page after page, and drops the trips the account no
 * longer belongs to; push sends the outbox FIFO, one mutation at a time.
 * Nothing runs until `start()`: then it syncs on boot, when the network
 * comes back, when the app returns to the foreground, every 5 minutes while
 * visible, and pulls after every push that got an answer.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly database = inject(OFFLINE_DB)
  private readonly api = inject(SYNC_API)
  private readonly clock = inject(CLOCK)
  private readonly meta = inject(MetaStore)
  private readonly outbox = inject(OutboxStore)
  private readonly onlineStore = inject(OnlineStore)
  private readonly notifier = inject(SYNC_NOTIFIER)
  private readonly document = inject(DOCUMENT)
  private readonly injector = inject(Injector)
  private readonly destroyRef = inject(DestroyRef)

  private readonly inFlight = signal(0)
  private pushing: Promise<void> | null = null
  private started = false

  /** True while a pull or a push is in flight. */
  readonly syncing = computed(() => this.inFlight() > 0)

  /** Idempotent; the app shell calls it once on boot. */
  start(): void {
    if (this.started) {
      return
    }
    this.started = true
    void this.boot()

    let wasOnline = untracked(this.onlineStore.online)
    effect(
      () => {
        const online = this.onlineStore.online()
        if (online && !wasOnline) {
          untracked(() => this.trigger(() => this.syncNow()))
        }
        wasOnline = online
      },
      { injector: this.injector }
    )

    const onVisibility = () => {
      if (this.visible()) {
        this.trigger(() => this.syncNow())
      }
    }
    this.document.addEventListener('visibilitychange', onVisibility)
    const timer = setInterval(() => {
      if (this.visible()) {
        this.trigger(() => this.pull())
      }
    }, PULL_INTERVAL_MS)
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timer)
    })
  }

  /**
   * Fetches what changed since the stored cursor and applies it page by
   * page, each page atomically. An expired cursor (410) clears the device's
   * copy, keeps the outbox and starts over without a cursor.
   */
  async pull(): Promise<void> {
    await this.track(async () => {
      try {
        await this.pullPages()
      } catch (error) {
        if (!(error instanceof SyncCursorExpired)) {
          throw error
        }
        await this.clearCopy()
        await this.pullPages()
      }
    })
  }

  /**
   * Sends the outbox until it is empty or the network fails. A concurrent
   * call joins the push already running instead of starting a second one.
   */
  push(): Promise<void> {
    this.pushing ??= this.track(() => this.drain()).finally(() => {
      this.pushing = null
    })
    return this.pushing
  }

  /** Pull, then push (which pulls again when the server answered). */
  async syncNow(): Promise<void> {
    await this.pull()
    await this.push()
  }

  /** A screen asks for a sync in the background: silent while offline or when the server fails. */
  requestSync(): void {
    void this.trigger(() => this.syncNow())
  }

  /** A screen queued a mutation: send it now when online, silently. */
  requestPush(): void {
    void this.trigger(() => this.push())
  }

  private async boot(): Promise<void> {
    await this.outbox.resetSyncing()
    if (untracked(this.onlineStore.online)) {
      await this.trigger(() => this.syncNow())
    }
  }

  private async pullPages(): Promise<void> {
    let hasMore = true
    while (hasMore) {
      const cursor = (await this.meta.get<string>(META_CURSOR)) ?? null
      const result = await this.api.pull(cursor)
      const pulledAt = this.clock()
      const db = await this.database
      await db.transaction(
        'rw',
        [...SYNC_TABLES.map((table) => db.table(table)), db.meta, db.outbox],
        async () => {
          const pending = await this.outbox.pendingFieldsByRow(db)
          for (const change of result.changes) {
            await apply(db, change, pending.get(change.row.id))
          }
          if (result.tripIds) {
            await dropOtherTrips(db, new Set(result.tripIds))
          }
          await db.meta.bulkPut([
            { key: META_CURSOR, value: result.cursor },
            { key: META_LAST_PULL_AT, value: pulledAt },
          ])
        }
      )
      hasMore = result.hasMore === true
    }
  }

  /** The device's copy of the trips (never the outbox nor the device facts) and the cursor. */
  private async clearCopy(): Promise<void> {
    const db = await this.database
    await db.transaction(
      'rw',
      [...SYNC_TABLES.map((table) => db.table(table)), db.meta],
      async () => {
        for (const table of SYNC_TABLES) {
          await db.table(table).clear()
        }
        await db.meta.delete(META_CURSOR)
      }
    )
  }

  private async drain(): Promise<void> {
    let answered = false
    for (let next = await this.outbox.nextToSend(); next; next = await this.outbox.nextToSend()) {
      if (!(await this.send(next))) {
        break
      }
      answered = true
    }
    if (answered) {
      await this.trigger(() => this.pull())
    }
  }

  /** Sends one mutation; false when there was no answer (retry later). */
  private async send(mutation: OutboxRecord): Promise<boolean> {
    await this.outbox.markSyncing(mutation.id)
    let result: SyncPushResult
    try {
      result = await this.api.push([{ ...mutation, state: 'syncing' }])
    } catch {
      await this.outbox.scheduleRetry(mutation.id)
      return false
    }
    const rejected = result.rejected.find((entry) => entry.id === mutation.id)
    const conflict = result.conflicts.find((entry) => entry.id === mutation.id)
    if (result.accepted.includes(mutation.id)) {
      await this.outbox.acknowledge(mutation.id)
    } else if (rejected) {
      await this.outbox.reject(mutation.id, rejected.message)
    } else if (conflict) {
      const db = await this.database
      await db.transaction('rw', db.table(conflict.serverRow.table), () =>
        apply(db, conflict.serverRow)
      )
      await this.outbox.acknowledge(mutation.id)
      this.notifier.conflictResolved()
    } else {
      // An answer that does not mention the mutation counts as no answer.
      await this.outbox.scheduleRetry(mutation.id)
      return false
    }
    return true
  }

  private async track<T>(work: () => Promise<T>): Promise<T> {
    this.inFlight.update((count) => count + 1)
    try {
      return await work()
    } finally {
      this.inFlight.update((count) => count - 1)
    }
  }

  /** Background triggers skip while offline and never throw: a later trigger retries. */
  private async trigger(work: () => Promise<void>): Promise<void> {
    if (!untracked(this.onlineStore.online)) {
      return
    }
    try {
      await work()
    } catch {
      // No answer from the server: the next trigger tries again.
    }
  }

  private visible(): boolean {
    return this.document.visibilityState === 'visible'
  }
}

/**
 * Writes one server change to its table: an upsert, or a delete. A row the
 * device has changed and not yet synced keeps those fields (and is left
 * alone while its deletion is on its way).
 */
async function apply(
  db: MonkiTripsDb,
  change: SyncChange,
  pendingFields?: ReadonlySet<string>
): Promise<void> {
  const table = db.table(change.table)
  if (change.deleted) {
    await table.delete(change.row.id)
    return
  }
  if (pendingFields && pendingFields.has('*')) {
    return
  }
  if (pendingFields && pendingFields.size > 0) {
    const local = await table.get(change.row.id)
    if (local) {
      await table.put(mergePendingRow(change.table, local, change.row, pendingFields))
      return
    }
  }
  await table.put(change.row)
}

/** The server's list of trips is authoritative: anything else leaves the device. */
async function dropOtherTrips(db: MonkiTripsDb, tripIds: ReadonlySet<string>): Promise<void> {
  const gone = (await db.trips.toCollection().primaryKeys()).filter((id) => !tripIds.has(id))
  if (gone.length === 0) {
    return
  }
  await db.trips.bulkDelete(gone)
  for (const table of TRIP_SCOPED_TABLES) {
    await db.table(table).where('tripId').anyOf(gone).delete()
  }
}
