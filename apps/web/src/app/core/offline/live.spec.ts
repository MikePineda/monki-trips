import 'fake-indexeddb/auto'
import { Injector, runInInjectionContext } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { freshOfflineDb, resetOfflineTesting } from '../../../testing/offline-testing'
import type { MonkiTripsDb } from './db'
import { liveSignal } from './live'

describe('liveSignal', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    db = freshOfflineDb()
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  it('starts with the initial value, then holds the query result', async () => {
    await db.meta.put({ key: 'k', value: 'stored' })
    const value = TestBed.runInInjectionContext(() =>
      liveSignal(async () => (await db.meta.get('k'))?.value, 'initial' as unknown)
    )

    expect(value()).toBe('initial')
    await vi.waitFor(() => expect(value()).toBe('stored'))
  })

  it('a signal updates after a table write', async () => {
    const count = TestBed.runInInjectionContext(() => liveSignal(() => db.trips.count(), -1))
    await vi.waitFor(() => expect(count()).toBe(0))

    await db.trips.put({
      id: 't1',
      name: 'Synthetic trip',
      startDate: '2027-01-15',
      endDate: '2027-01-30',
      baseCurrency: 'EUR',
      updatedAt: '2026-11-07T12:00:00.000Z',
    })

    await vi.waitFor(() => expect(count()).toBe(1))
  })

  it('works outside an injection context when given an injector', async () => {
    const injector = TestBed.inject(Injector)
    const count = liveSignal(() => db.outbox.count(), -1, { injector })

    await vi.waitFor(() => expect(count()).toBe(0))
  })

  it('stops listening when its injector is destroyed', async () => {
    const parent = TestBed.inject(Injector)
    const child = Injector.create({ providers: [], parent })
    const count = runInInjectionContext(child, () => liveSignal(() => db.tasks.count(), -1))
    await vi.waitFor(() => expect(count()).toBe(0))

    ;(child as Injector & { destroy(): void }).destroy()
    await db.tasks.put({ id: 'k1', tripId: 't1', title: 'x', done: false, updatedAt: 'x' })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(count()).toBe(0)
  })
})
