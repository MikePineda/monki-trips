import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { ConnectionStatusStore } from './connection-status.store'
import type { MonkiTripsDb } from './db'
import { META_LAST_PULL_AT, MetaStore } from './meta.store'
import { OutboxStore } from './outbox.store'

const EXPENSE = { tripId: 't1', kind: 'expense.create', payload: {} }

describe('ConnectionStatusStore', () => {
  let db: MonkiTripsDb
  let clock: TestClock

  function setup(online: boolean) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
    TestBed.configureTestingModule({ providers: provideOfflineTesting({ db, clock }) })
    return {
      store: TestBed.inject(ConnectionStatusStore),
      outbox: TestBed.inject(OutboxStore),
      meta: TestBed.inject(MetaStore),
    }
  }

  beforeEach(() => {
    db = freshOfflineDb()
    clock = new TestClock()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  it('offline with two queued mutations says offline and counts them', async () => {
    const { store, outbox } = setup(false)

    await outbox.enqueue(EXPENSE)
    await outbox.enqueue(EXPENSE)

    await vi.waitFor(() => expect(store.status()).toEqual({ state: 'offline', count: 2 }))
  })

  it('a failed mutation shows as failed', async () => {
    const { store, outbox } = setup(false)
    const queued = await outbox.enqueue(EXPENSE)
    await outbox.markSyncing(queued.id)

    await outbox.reject(queued.id, 'Rejected')

    await vi.waitFor(() => expect(store.status()).toEqual({ state: 'failed', count: 1 }))
  })

  it('online with a fresh pull and an empty outbox is synced', async () => {
    const { store, meta } = setup(true)

    await meta.set(META_LAST_PULL_AT, clock.now)

    await vi.waitFor(() => expect(store.status()).toEqual({ state: 'synced', count: 0 }))
  })

  it('data pulled two days ago is stale', async () => {
    const { store, meta } = setup(true)
    await meta.set(META_LAST_PULL_AT, '2026-11-05T11:00:00.000Z')

    await vi.waitFor(() => expect(store.status()).toEqual({ state: 'stale', count: 2 }))
  })
})
