import type { Provider } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { Dexie } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { CLOCK } from '../app/core/offline/clock'
import { MonkiTripsDb, OFFLINE_DB } from '../app/core/offline/db'
import { FakeSyncApi, SYNC_API, type SyncApi } from '../app/core/offline/sync-api'
import { SYNC_NOTIFIER, type SyncNotifier } from '../app/core/offline/sync.service'

/** The instant specs run at unless they move the clock. */
export const TEST_NOW = '2026-11-07T12:00:00.000Z'

/** A clock a spec can move: `clock.now` is what CLOCK returns. */
export class TestClock {
  constructor(public now: string = TEST_NOW) {}

  readonly read = (): string => this.now

  advance(ms: number): void {
    this.now = new Date(Date.parse(this.now) + ms).toISOString()
  }
}

/** A sync notifier that counts what it was told. */
export class RecordingSyncNotifier implements SyncNotifier {
  conflicts = 0

  conflictResolved(): void {
    this.conflicts += 1
  }
}

/**
 * A MonkiTripsDb on its own in-memory IndexedDB factory: nothing leaks
 * between tests, even with the same database name.
 *
 * It also points Dexie's global dependencies at that factory: `ng test`
 * runs every spec in one shared module graph, Dexie may load before
 * `fake-indexeddb/auto` runs, and then `liveQuery` silently never queries
 * (it checks `Dexie.dependencies.indexedDB`).
 */
export function freshOfflineDb(): MonkiTripsDb {
  const indexedDB = new IDBFactory()
  Dexie.dependencies.indexedDB = indexedDB
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
  return new MonkiTripsDb({ indexedDB, IDBKeyRange })
}

export interface OfflineTestingOptions {
  db: MonkiTripsDb
  clock?: TestClock
  api?: SyncApi
  notifier?: SyncNotifier
}

/**
 * Providers for a spec that touches the offline core: the given fresh db,
 * a fixed clock (TEST_NOW unless given), the fake sync API and a
 * no-op notifier unless given.
 */
export function provideOfflineTesting(options: OfflineTestingOptions): Provider[] {
  const clock = options.clock ?? new TestClock()
  return [
    { provide: OFFLINE_DB, useValue: options.db },
    { provide: CLOCK, useValue: clock.read },
    { provide: SYNC_API, useValue: options.api ?? new FakeSyncApi() },
    { provide: SYNC_NOTIFIER, useValue: options.notifier ?? new RecordingSyncNotifier() },
  ]
}

/**
 * afterEach: destroys the TestBed first (live queries, listeners and timers
 * end with it), then deletes the database.
 */
export async function resetOfflineTesting(db: MonkiTripsDb): Promise<void> {
  TestBed.resetTestingModule()
  await db.delete()
}
