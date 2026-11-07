import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import {
  RecordingSyncNotifier,
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from './db'
import { META_CURSOR, META_LAST_PULL_AT, MetaStore } from './meta.store'
import { OutboxStore } from './outbox.store'
import type { ExpenseRecord } from './records'
import { FakeSyncApi } from './sync-api'
import { SyncService } from './sync.service'

const EXPENSE: ExpenseRecord = {
  id: 'x1',
  tripId: 't1',
  date: '2027-01-16',
  description: 'Synthetic lunch',
  amountMinor: 1250,
  currency: 'EUR',
  updatedAt: '2026-11-07T11:00:00.000Z',
  syncState: 'pending',
}

const SERVER_EXPENSE: ExpenseRecord = {
  id: 'x1',
  tripId: 't1',
  date: '2027-01-16',
  description: 'Synthetic lunch (edited by another member)',
  amountMinor: 1800,
  currency: 'EUR',
  updatedAt: '2026-11-07T11:30:00.000Z',
}

describe('SyncService', () => {
  let db: MonkiTripsDb
  let clock: TestClock
  let api: FakeSyncApi
  let notifier: RecordingSyncNotifier
  let sync: SyncService
  let outbox: OutboxStore
  let meta: MetaStore

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    db = freshOfflineDb()
    clock = new TestClock()
    api = new FakeSyncApi()
    notifier = new RecordingSyncNotifier()
    TestBed.configureTestingModule({
      providers: provideOfflineTesting({ db, clock, api, notifier }),
    })
    sync = TestBed.inject(SyncService)
    outbox = TestBed.inject(OutboxStore)
    meta = TestBed.inject(MetaStore)
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  it('server wins on conflict and shows a toast', async () => {
    await db.expenses.put(EXPENSE)
    const queued = await outbox.enqueue({ tripId: 't1', kind: 'expense.update', payload: EXPENSE })
    api.conflictNext(queued.id, { table: 'expenses', row: SERVER_EXPENSE })

    await sync.push()

    expect(await db.expenses.get('x1')).toEqual(SERVER_EXPENSE)
    expect(await db.outbox.get(queued.id)).toBeUndefined()
    expect(notifier.conflicts).toBe(1)
  })

  it('pull cursor is persisted in meta', async () => {
    clock.now = '2026-11-07T13:14:15.000Z'

    await sync.pull()

    expect(api.calls).toEqual([{ kind: 'pull', cursor: null }])
    expect(await meta.get(META_CURSOR)).toBe('fake-1')
    expect(await meta.get(META_LAST_PULL_AT)).toBe('2026-11-07T13:14:15.000Z')
  })

  it('the next pull sends the stored cursor', async () => {
    await sync.pull()
    await sync.pull()

    expect(api.calls).toEqual([
      { kind: 'pull', cursor: null },
      { kind: 'pull', cursor: 'fake-1' },
    ])
  })

  it('a pull upserts changed rows and applies deletes', async () => {
    await db.expenses.put(EXPENSE)
    await db.tasks.put({ id: 'k1', tripId: 't1', title: 'Old', done: false, updatedAt: 'x' })
    api.queuePullChanges(
      { table: 'expenses', row: EXPENSE, deleted: true },
      { table: 'tasks', row: { id: 'k1', tripId: 't1', title: 'New', done: true, updatedAt: 'y' } },
      {
        table: 'events',
        row: { id: 'e1', tripId: 't1', day: '2027-01-15', title: 'Fly', updatedAt: 'y' },
      }
    )

    await sync.pull()

    expect(await db.expenses.get('x1')).toBeUndefined()
    expect(await db.tasks.get('k1')).toMatchObject({ title: 'New', done: true })
    expect(await db.events.get('e1')).toMatchObject({ title: 'Fly' })
  })

  it('a failed pull keeps the old cursor and the old rows', async () => {
    await meta.set(META_CURSOR, 'kept')
    api.failNextPullWith(new TypeError('Failed to fetch'))

    await expect(sync.pull()).rejects.toThrow('Failed to fetch')

    expect(await meta.get(META_CURSOR)).toBe('kept')
    expect(await meta.get(META_LAST_PULL_AT)).toBeUndefined()
    expect(sync.syncing()).toBe(false)
  })

  it('a network error schedules a retry with backoff and leaves the entry pending', async () => {
    const first = await outbox.enqueue({ tripId: 't1', kind: 'expense.create', payload: {} })
    await outbox.enqueue({ tripId: 't1', kind: 'expense.create', payload: {} })
    api.failNextPushWith(new TypeError('Failed to fetch'))

    await sync.push()

    expect(api.pushedIds()).toEqual([first.id])
    expect(await db.outbox.get(first.id)).toMatchObject({
      state: 'pending',
      attempts: 1,
      nextAttemptAt: '2026-11-07T12:00:01.000Z',
    })
    expect(api.calls.some((call) => call.kind === 'pull')).toBe(false)
  })

  it('pushes the whole outbox one mutation at a time, oldest first, then pulls', async () => {
    const a = await outbox.enqueue({ tripId: 't1', kind: 'task.toggle', payload: {} })
    const b = await outbox.enqueue({ tripId: 't1', kind: 'task.toggle', payload: {} })

    await sync.push()

    expect(api.calls).toEqual([
      { kind: 'push', ids: [a.id] },
      { kind: 'push', ids: [b.id] },
      { kind: 'pull', cursor: null },
    ])
    expect(await db.outbox.count()).toBe(0)
  })

  it('never runs two pushes at once', async () => {
    const a = await outbox.enqueue({ tripId: 't1', kind: 'task.toggle', payload: {} })

    await Promise.all([sync.push(), sync.push(), sync.push()])

    expect(api.pushedIds()).toEqual([a.id])
  })

  it('is syncing while a pull is in flight', async () => {
    const pulling = sync.pull()

    expect(sync.syncing()).toBe(true)
    await pulling
    expect(sync.syncing()).toBe(false)
  })

  it('sync now pulls, pushes and pulls again', async () => {
    const a = await outbox.enqueue({ tripId: 't1', kind: 'task.toggle', payload: {} })

    await sync.syncNow()

    expect(api.calls).toEqual([
      { kind: 'pull', cursor: null },
      { kind: 'push', ids: [a.id] },
      { kind: 'pull', cursor: 'fake-1' },
    ])
  })

  it('start puts interrupted mutations back and syncs', async () => {
    const caught = await outbox.enqueue({ tripId: 't1', kind: 'task.toggle', payload: {} })
    await outbox.markSyncing(caught.id)

    sync.start()

    await vi.waitFor(async () => expect(await db.outbox.count()).toBe(0))
    expect(api.calls[0]).toEqual({ kind: 'pull', cursor: null })
    expect(api.pushedIds()).toEqual([caught.id])
  })

  it('does not start on its own', async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(api.calls).toEqual([])
  })

  it('pulls when the app comes back to the foreground', async () => {
    sync.start()
    await vi.waitFor(() => expect(api.calls.length).toBe(1))
    await vi.waitFor(() => expect(sync.syncing()).toBe(false))

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() => expect(api.calls.length).toBe(2))
    expect(api.calls[1]).toEqual({ kind: 'pull', cursor: 'fake-1' })
  })

  it('pulls every five minutes while visible, and not while hidden', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    sync.start()
    await vi.waitFor(() => expect(api.calls.length).toBe(1))
    await vi.waitFor(() => expect(sync.syncing()).toBe(false))

    vi.advanceTimersByTime(5 * 60 * 1000)
    await vi.waitFor(() => expect(api.calls.length).toBe(2))
    await vi.waitFor(() => expect(sync.syncing()).toBe(false))

    visibility.mockReturnValue('hidden')
    vi.advanceTimersByTime(5 * 60 * 1000)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(api.calls.length).toBe(2)
  })

  it('stays quiet while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    await outbox.enqueue({ tripId: 't1', kind: 'task.toggle', payload: {} })

    sync.start()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(api.calls).toEqual([])
  })
})
