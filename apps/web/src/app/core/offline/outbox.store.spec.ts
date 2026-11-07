import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { IllegalOutboxTransition } from '../../domain/outbox-transition'
import type { MonkiTripsDb } from './db'
import { OutboxStore } from './outbox.store'
import { FakeSyncApi } from './sync-api'
import { SyncService } from './sync.service'

const EXPENSE = { tripId: 't1', kind: 'expense.create', payload: { amountMinor: 1250 } }

describe('OutboxStore', () => {
  let db: MonkiTripsDb
  let clock: TestClock
  let api: FakeSyncApi
  let outbox: OutboxStore

  beforeEach(() => {
    db = freshOfflineDb()
    clock = new TestClock()
    api = new FakeSyncApi()
    TestBed.configureTestingModule({ providers: provideOfflineTesting({ db, clock, api }) })
    outbox = TestBed.inject(OutboxStore)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  describe('with the sync service', () => {
    it('queued mutation is sent once when back online', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      const sync = TestBed.inject(SyncService)
      sync.start()
      window.dispatchEvent(new Event('offline'))

      const queued = await outbox.enqueue(EXPENSE)
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(api.pushedIds()).toEqual([])

      window.dispatchEvent(new Event('online'))
      TestBed.tick()

      await vi.waitFor(async () => expect(await db.outbox.count()).toBe(0))
      await vi.waitFor(() => expect(sync.syncing()).toBe(false))
      expect(api.calls.filter((call) => call.kind === 'push')).toEqual([
        { kind: 'push', ids: [queued.id] },
      ])
    })

    it('failed mutation stays visible until the user decides', async () => {
      const sync = TestBed.inject(SyncService)
      const queued = await outbox.enqueue(EXPENSE)
      api.rejectNext(queued.id, 'Amount must be positive')

      await sync.push()

      const failed = await db.outbox.get(queued.id)
      expect(failed).toMatchObject({ state: 'failed', error: 'Amount must be positive' })
      await vi.waitFor(() => expect(outbox.failed().map((entry) => entry.id)).toEqual([queued.id]))

      await sync.push()
      expect(api.pushedIds()).toEqual([queued.id])
      expect(outbox.failed().map((entry) => entry.id)).toEqual([queued.id])
      expect(await db.outbox.get(queued.id)).toMatchObject({ state: 'failed' })

      await outbox.retry(queued.id)
      api.rejectNext(queued.id, 'Still invalid')
      await sync.push()
      expect(api.pushedIds()).toEqual([queued.id, queued.id])
      expect(await db.outbox.get(queued.id)).toMatchObject({ error: 'Still invalid' })

      await outbox.discard(queued.id)
      expect(await db.outbox.count()).toBe(0)
      await vi.waitFor(() => expect(outbox.failed()).toEqual([]))
    })
  })

  it('unsentCount counts pending, syncing and failed entries, read now', async () => {
    const first = await outbox.enqueue({ tripId: 't1', kind: 'expense.create', payload: {} })
    const second = await outbox.enqueue({ tripId: 't1', kind: 'expense.create', payload: {} })
    await outbox.enqueue({ tripId: 't1', kind: 'expense.create', payload: {} })
    await outbox.markSyncing(first.id)
    await outbox.markSyncing(second.id)
    await outbox.reject(second.id, 'refused')

    expect(await outbox.unsentCount()).toBe(3)
  })

  it('a queued mutation is pending with a UUIDv7 id and the clock time', async () => {
    const queued = await outbox.enqueue(EXPENSE)

    expect(queued).toEqual({
      id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      ),
      ...EXPENSE,
      state: 'pending',
      attempts: 0,
      createdAt: clock.now,
      nextAttemptAt: null,
      error: null,
    })
    expect(await db.outbox.get(queued.id)).toEqual(queued)
  })

  it('sends mutations first in, first out', async () => {
    const first = await outbox.enqueue(EXPENSE)
    clock.advance(1000)
    const second = await outbox.enqueue(EXPENSE)
    const third = await outbox.enqueue(EXPENSE)

    expect((await outbox.nextToSend())?.id).toBe(first.id)
    await outbox.markSyncing(first.id)
    expect((await outbox.nextToSend())?.id).toBe(second.id)
    await outbox.markSyncing(second.id)
    expect((await outbox.nextToSend())?.id).toBe(third.id)
  })

  it('nothing is sent while the outbox is empty or only failed', async () => {
    expect(await outbox.nextToSend()).toBeUndefined()

    const queued = await outbox.enqueue(EXPENSE)
    await outbox.markSyncing(queued.id)
    await outbox.reject(queued.id, 'No')

    expect(await outbox.nextToSend()).toBeUndefined()
  })

  it('an acknowledged mutation leaves the outbox', async () => {
    const queued = await outbox.enqueue(EXPENSE)
    await outbox.markSyncing(queued.id)

    await outbox.acknowledge(queued.id)

    expect(await db.outbox.get(queued.id)).toBeUndefined()
  })

  it('a network error waits 1 s, then 2 s, then 4 s before resending', async () => {
    const queued = await outbox.enqueue(EXPENSE)

    for (const [attempts, waitMs] of [
      [1, 1000],
      [2, 2000],
      [3, 4000],
    ]) {
      await outbox.markSyncing(queued.id)
      await outbox.scheduleRetry(queued.id)

      const entry = await db.outbox.get(queued.id)
      expect(entry).toMatchObject({ state: 'pending', attempts })
      expect(Date.parse(entry?.nextAttemptAt ?? '') - Date.parse(clock.now)).toBe(waitMs)
      expect(await outbox.nextToSend()).toBeUndefined()

      clock.advance(waitMs)
      expect((await outbox.nextToSend())?.id).toBe(queued.id)
    }
  })

  it('a mutation waiting for its backoff does not hold back a newer one', async () => {
    const waiting = await outbox.enqueue(EXPENSE)
    const fresh = await outbox.enqueue(EXPENSE)
    await outbox.markSyncing(waiting.id)
    await outbox.scheduleRetry(waiting.id)

    expect((await outbox.nextToSend())?.id).toBe(fresh.id)
  })

  it('retry by the user starts the attempts over', async () => {
    const queued = await outbox.enqueue(EXPENSE)
    await outbox.markSyncing(queued.id)
    await outbox.scheduleRetry(queued.id)
    await outbox.markSyncing(queued.id)
    await outbox.reject(queued.id, 'Rejected')

    await outbox.retry(queued.id)

    expect(await db.outbox.get(queued.id)).toMatchObject({
      state: 'pending',
      attempts: 0,
      nextAttemptAt: null,
      error: null,
    })
  })

  it('boot puts mutations caught mid-sync back to pending', async () => {
    const caught = await outbox.enqueue(EXPENSE)
    const untouched = await outbox.enqueue(EXPENSE)
    await outbox.markSyncing(caught.id)

    await outbox.resetSyncing()

    expect((await db.outbox.get(caught.id))?.state).toBe('pending')
    expect((await db.outbox.get(untouched.id))?.state).toBe('pending')
  })

  it('every state move goes through the state machine', async () => {
    const queued = await outbox.enqueue(EXPENSE)

    await expect(outbox.reject(queued.id, 'No')).rejects.toThrow(IllegalOutboxTransition)
    await expect(outbox.acknowledge(queued.id)).rejects.toThrow(IllegalOutboxTransition)
    await expect(outbox.discard(queued.id)).rejects.toThrow(IllegalOutboxTransition)
    await expect(outbox.retry(queued.id)).rejects.toThrow(IllegalOutboxTransition)
    expect((await db.outbox.get(queued.id))?.state).toBe('pending')
  })

  it('a move on a mutation that is gone throws', async () => {
    await expect(outbox.markSyncing('missing')).rejects.toThrow('missing')
  })

  it('counts pending (with syncing) and failed entries live', async () => {
    const a = await outbox.enqueue(EXPENSE)
    const b = await outbox.enqueue(EXPENSE)
    await outbox.enqueue(EXPENSE)
    await outbox.markSyncing(a.id)
    await outbox.markSyncing(b.id)
    await outbox.reject(b.id, 'No')

    await vi.waitFor(() => {
      expect(outbox.pendingCount()).toBe(2)
      expect(outbox.failedCount()).toBe(1)
      expect(outbox.failed().map((entry) => entry.id)).toEqual([b.id])
    })
  })
})
