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
import { SYNC_TABLES, type OutboxRecord, type SyncChange } from './records'
import { SYNC_API, type SyncPushResult } from './sync-api'

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

/**
 * Keeps Dexie and the server in step. Pull refills the local tables from
 * the stored cursor; push sends the outbox FIFO, one mutation at a time.
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

  /** Fetches what changed since the stored cursor and applies it atomically. */
  async pull(): Promise<void> {
    await this.track(async () => {
      const cursor = (await this.meta.get<string>(META_CURSOR)) ?? null
      const result = await this.api.pull(cursor)
      const pulledAt = this.clock()
      const db = await this.database
      await db.transaction(
        'rw',
        [...SYNC_TABLES.map((table) => db.table(table)), db.meta],
        async () => {
          for (const change of result.changes) {
            await apply(db, change)
          }
          await db.meta.bulkPut([
            { key: META_CURSOR, value: result.cursor },
            { key: META_LAST_PULL_AT, value: pulledAt },
          ])
        }
      )
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

  private async boot(): Promise<void> {
    await this.outbox.resetSyncing()
    if (untracked(this.onlineStore.online)) {
      await this.trigger(() => this.syncNow())
    }
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

/** Writes one server change to its table: an upsert, or a delete. */
async function apply(db: MonkiTripsDb, change: SyncChange): Promise<void> {
  const table = db.table(change.table)
  if (change.deleted) {
    await table.delete(change.row.id)
  } else {
    await table.put(change.row)
  }
}
