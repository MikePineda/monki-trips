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
import { META_CURSOR, META_LAST_PULL_AT, META_SYNCED_ENTITIES, MetaStore } from './meta.store'
import { syncedEntitiesKey } from './entity-tables'
import { OutboxStore } from './outbox.store'
import type { EmergencyRecord, ExpenseRecord, TaskRecord } from './records'
import { SyncCursorExpired } from './sync-api'
import { FakeSyncApi } from '../../../testing/fake-sync-api'
import { SyncService } from './sync.service'
import { toEventRecord } from './event-record'
import { blankEvent, blankStop } from '../../../testing/fake-trip-content'
import { toStopRecord } from './stop-record'
import { expenseRecord } from '../../../testing/money-fixtures'

const EXPENSE: ExpenseRecord = expenseRecord({
  id: 'x1',
  tripId: 't1',
  spentOn: '2027-01-16',
  description: 'Synthetic lunch',
  amountMinor: 1250,
  currency: 'EUR',
  updatedAt: '2026-11-07T11:00:00.000Z',
  syncState: 'pending',
})

const TASK: TaskRecord = {
  id: 'k1',
  tripId: 't1',
  eventId: null,
  title: 'Synthetic task',
  titleKey: null,
  notes: null,
  dueOn: '2027-01-10',
  priority: 'normal',
  doneAt: null,
  doneBy: null,
  origin: 'manual',
  sourceDocumentId: null,
  templateItemKey: null,
  updatedAt: '2026-11-07T11:00:00.000Z',
}

const SERVER_EXPENSE: ExpenseRecord = expenseRecord({
  id: 'x1',
  tripId: 't1',
  spentOn: '2027-01-16',
  description: 'Synthetic lunch (edited by another member)',
  amountMinor: 1800,
  currency: 'EUR',
  updatedAt: '2026-11-07T11:30:00.000Z',
})

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
    await db.tasks.put({ ...TASK, title: 'Old', updatedAt: 'x' })
    api.queuePullChanges(
      { table: 'expenses', row: EXPENSE, deleted: true },
      { table: 'tasks', row: { ...TASK, title: 'New', doneAt: '2026-11-07T11:00:00.000Z' } },
      {
        table: 'events',
        row: toEventRecord(
          blankEvent({ id: 'e1', tripId: 't1', startsOn: '2027-01-15', title: 'Fly' })
        ),
      }
    )

    await sync.pull()

    expect(await db.expenses.get('x1')).toBeUndefined()
    expect(await db.tasks.get('k1')).toMatchObject({
      title: 'New',
      doneAt: '2026-11-07T11:00:00.000Z',
    })
    expect(await db.events.get('e1')).toMatchObject({ title: 'Fly' })
  })

  it('a newly mapped entity makes the next pull start from scratch once', async () => {
    await meta.set(META_CURSOR, 'from-an-older-mapping')
    await meta.set(META_SYNCED_ENTITIES, 'event,task,trip')

    await sync.pull()
    await sync.pull()

    expect(api.calls).toEqual([
      { kind: 'pull', cursor: null },
      { kind: 'pull', cursor: 'fake-1' },
    ])
    expect(await meta.get(META_SYNCED_ENTITIES)).toBe(syncedEntitiesKey())
  })

  it('a cursor stored before the mapping was recorded (a device upgraded from Dexie version 4) pulls from scratch once', async () => {
    await meta.set(META_CURSOR, 'from-before-the-money-mapping')

    await sync.pull()
    await sync.pull()

    expect(api.calls).toEqual([
      { kind: 'pull', cursor: null },
      { kind: 'pull', cursor: 'fake-1' },
    ])
    expect(await meta.get(META_SYNCED_ENTITIES)).toBe(syncedEntitiesKey())
  })

  it('the same mapping keeps pulling from the stored cursor', async () => {
    await meta.set(META_CURSOR, 'kept-cursor')
    await meta.set(META_SYNCED_ENTITIES, syncedEntitiesKey())

    await sync.pull()

    expect(api.calls).toEqual([{ kind: 'pull', cursor: 'kept-cursor' }])
  })

  it('the server print task replaces the optimistic one the device made for the document', async () => {
    await db.tasks.bulkPut([
      {
        ...TASK,
        id: 'local-print',
        origin: 'document',
        sourceDocumentId: 'doc-1',
        syncState: 'pending',
      },
      { ...TASK, id: 'other-doc', origin: 'document', sourceDocumentId: 'doc-2' },
    ])
    api.queuePullChanges({
      table: 'tasks',
      row: { ...TASK, id: 'server-print', origin: 'document', sourceDocumentId: 'doc-1' },
    })

    await sync.pull()

    expect((await db.tasks.toArray()).map((task) => task.id).sort()).toEqual([
      'other-doc',
      'server-print',
    ])
  })

  it('a failed pull keeps the old cursor and the old rows', async () => {
    await meta.set(META_CURSOR, 'kept')
    await meta.set(META_SYNCED_ENTITIES, syncedEntitiesKey())
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

  it('a pulled row keeps the fields a pending mutation still carries', async () => {
    await db.tasks.put({ ...TASK, doneAt: '2026-11-07T12:00:00.000Z', syncState: 'pending' })
    await outbox.enqueue({
      tripId: 't1',
      kind: 'task.upsert',
      payload: {
        entity: 'task',
        op: 'upsert',
        id: 'k1',
        changes: { doneAt: '2026-11-07T12:00:00.000Z' },
        changedAt: '2026-11-07T12:00:00.000Z',
      },
    })
    api.queuePullChanges({
      table: 'tasks',
      row: { ...TASK, title: 'Renamed by a partner', updatedAt: '2026-11-07T12:00:01.000Z' },
    })

    await sync.pull()

    expect(await db.tasks.get('k1')).toMatchObject({
      title: 'Renamed by a partner',
      doneAt: '2026-11-07T12:00:00.000Z',
      syncState: 'pending',
    })
  })

  it('emergency fields merge per key while one key is pending', async () => {
    const local: EmergencyRecord = {
      id: 't1',
      tripId: 't1',
      content: { insurance: { provider: 'Demo Assure', policyNumber: 'DEMO-1', phone: null } },
      schemaVersion: 1,
      updatedAt: '2026-11-07T12:00:00.000Z',
      syncState: 'pending',
    }
    await db.emergency.put(local)
    await outbox.enqueue({
      tripId: 't1',
      kind: 'emergency.upsert',
      payload: {
        entity: 'emergency',
        op: 'upsert',
        id: 't1',
        changes: { insurance: local.content.insurance },
        changedAt: '2026-11-07T12:00:00.000Z',
      },
    })
    api.queuePullChanges({
      table: 'emergency',
      row: {
        ...local,
        syncState: undefined,
        content: {
          insurance: { provider: 'Older insurer', policyNumber: null, phone: null },
          embassy: { name: 'Consulate of Demo', phone: '+1 555 0100', address: null },
        },
        updatedAt: '2026-11-07T12:00:01.000Z',
      },
    })

    await sync.pull()

    expect((await db.emergency.get('t1'))?.content).toEqual({
      insurance: { provider: 'Demo Assure', policyNumber: 'DEMO-1', phone: null },
      embassy: { name: 'Consulate of Demo', phone: '+1 555 0100', address: null },
    })
  })

  it('a row whose deletion is pending is not brought back by a pull', async () => {
    await outbox.enqueue({
      tripId: 't1',
      kind: 'task.delete',
      payload: { entity: 'task', op: 'delete', id: 'k1', changes: {}, changedAt: TASK.updatedAt },
    })
    api.queuePullChanges({ table: 'tasks', row: TASK })

    await sync.pull()

    expect(await db.tasks.get('k1')).toBeUndefined()
  })

  it('drops the trips the server no longer lists, with their rows', async () => {
    await db.trips.bulkPut([
      {
        id: 't1',
        name: 'Kept',
        startDate: '2027-01-01',
        endDate: '2027-01-02',
        baseCurrency: 'EUR',
        updatedAt: 'x',
      },
      {
        id: 't2',
        name: 'Left',
        startDate: '2027-01-01',
        endDate: '2027-01-02',
        baseCurrency: 'EUR',
        updatedAt: 'x',
      },
    ])
    await db.tasks.bulkPut([TASK, { ...TASK, id: 'k2', tripId: 't2' }])
    api.queuePullTripIds(['t1'])

    await sync.pull()

    expect((await db.trips.toArray()).map((trip) => trip.id)).toEqual(['t1'])
    expect((await db.tasks.toArray()).map((task) => task.id)).toEqual(['k1'])
  })

  it('an expired cursor clears the copy, keeps the outbox and pulls from scratch', async () => {
    await meta.set(META_CURSOR, 'stale')
    await meta.set(META_SYNCED_ENTITIES, syncedEntitiesKey())
    await db.tasks.put(TASK)
    const queued = await outbox.enqueue({ tripId: 't1', kind: 'task.upsert', payload: {} })
    api.failNextPullWith(new SyncCursorExpired())
    api.queuePullChanges({ table: 'tasks', row: { ...TASK, id: 'k9' } })

    await sync.pull()

    expect(api.calls).toEqual([
      { kind: 'pull', cursor: 'stale' },
      { kind: 'pull', cursor: null },
    ])
    expect((await db.tasks.toArray()).map((task) => task.id)).toEqual(['k9'])
    expect(await db.outbox.get(queued.id)).toBeDefined()
    expect(await meta.get(META_CURSOR)).toBe('fake-1')
  })

  it('stays quiet while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    await outbox.enqueue({ tripId: 't1', kind: 'task.toggle', payload: {} })

    sync.start()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(api.calls).toEqual([])
  })
  it('pull applies changes and advances the cursor', async () => {
    clock.now = '2026-11-07T13:14:15.000Z'
    await db.events.put(toEventRecord(blankEvent({ id: 'old', tripId: 'trip-1', title: 'Old' })))
    api.queuePullChanges(
      { table: 'stops', row: toStopRecord(blankStop({ id: 's1' })) },
      {
        table: 'events',
        row: toEventRecord(blankEvent({ id: 'e1', tripId: 'trip-1', title: 'Fly' })),
      },
      { table: 'events', row: { id: 'old' }, deleted: true }
    )

    await sync.pull()

    expect(api.calls).toEqual([{ kind: 'pull', cursor: null }])
    expect(await db.stops.get('s1')).toMatchObject({ name: 'Port Vellmar' })
    expect(await db.events.get('e1')).toMatchObject({ title: 'Fly' })
    expect(await db.events.get('old')).toBeUndefined()
    expect(await meta.get(META_CURSOR)).toBe('fake-1')
    expect(await meta.get(META_LAST_PULL_AT)).toBe('2026-11-07T13:14:15.000Z')

    await sync.pull()
    expect(api.calls[1]).toEqual({ kind: 'pull', cursor: 'fake-1' })
  })

  it('expired cursor wipes the cache but keeps the outbox', async () => {
    await meta.set(META_CURSOR, 'stale-cursor')
    await meta.set(META_SYNCED_ENTITIES, syncedEntitiesKey())
    await db.events.put(toEventRecord(blankEvent({ id: 'cached', tripId: 'trip-1' })))
    const queued = await outbox.enqueue({
      tripId: 'trip-1',
      kind: 'event.upsert',
      payload: {
        entity: 'event',
        op: 'upsert',
        id: 'cached',
        changes: { title: 'Mine' },
        changedAt: clock.now,
      },
    })
    api.failNextPullWith(new SyncCursorExpired())
    api.queuePullChanges({
      table: 'events',
      row: toEventRecord(blankEvent({ id: 'fresh', tripId: 'trip-1' })),
    })

    await sync.pull()

    expect(api.calls).toEqual([
      { kind: 'pull', cursor: 'stale-cursor' },
      { kind: 'pull', cursor: null },
    ])
    expect(await db.events.get('cached')).toBeUndefined()
    expect(await db.events.get('fresh')).toBeDefined()
    expect(await db.outbox.get(queued.id)).toMatchObject({ state: 'pending' })
    expect(await meta.get(META_CURSOR)).toBe('fake-1')
  })

  it('rejected mutation stays visible as failed', async () => {
    await db.events.put({
      ...toEventRecord(blankEvent({ id: 'e1', tripId: 'trip-1', title: 'Harbour walk' })),
      syncState: 'pending',
    })
    const queued = await outbox.enqueue({
      tripId: 'trip-1',
      kind: 'event.upsert',
      payload: {
        entity: 'event',
        op: 'upsert',
        id: 'e1',
        changes: { title: 'Harbour walk' },
        changedAt: clock.now,
      },
    })
    api.rejectNext(queued.id, 'No such time')

    await sync.push()

    expect(await db.outbox.get(queued.id)).toMatchObject({ state: 'failed', error: 'No such time' })
    expect(await db.events.get('e1')).toMatchObject({ title: 'Harbour walk', syncState: 'failed' })
    await vi.waitFor(() => expect(outbox.failedCount()).toBe(1))
  })
})
