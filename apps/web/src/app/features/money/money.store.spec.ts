import { TestBed } from '@angular/core/testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { FakeSyncApi } from '../../../testing/fake-sync-api'
import { DEMO_TRIP_RECORD } from '../../../testing/fake-trip-content'
import { defaultCategoryRecords, expenseRecord } from '../../../testing/money-fixtures'
import type { MonkiTripsDb } from '../../core/offline/db'
import { outboxMutation } from '../../core/offline/mutation'
import { SyncService } from '../../core/offline/sync.service'
import { MoneyStore } from './money.store'

describe('MoneyStore', () => {
  let db: MonkiTripsDb
  let api: FakeSyncApi
  let clock: TestClock

  beforeEach(async () => {
    // Offline: background pushes skip, so the spec decides when the outbox is sent.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    api = new FakeSyncApi()
    clock = new TestClock('2027-01-21T03:00:00.000Z')
    TestBed.configureTestingModule({
      providers: provideOfflineTesting({ db, api, clock }),
    })
    await db.trips.put(DEMO_TRIP_RECORD)
    await db.budgetCategories.bulkPut(defaultCategoryRecords())
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  const quick = {
    tripId: 'trip-1',
    baseCurrency: 'AUD',
    amountMinor: 4500,
    currency: 'THB',
    categoryId: 'cat-food',
    spentOn: '2027-01-21',
    paidByTravellerId: null,
  }

  async function mutations() {
    return (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
  }

  it('quick expense saves with amount and category only', async () => {
    const saved = await TestBed.inject(MoneyStore).addQuick(quick)

    const stored = await db.expenses.get(saved.id)
    expect(stored).toMatchObject({
      amountMinor: 4500,
      currency: 'THB',
      categoryId: 'cat-food',
      needsDetails: true,
      description: null,
      syncState: 'pending',
      // Never a rate invented on the device: the server attaches the rate of the day.
      fxRate: null,
      baseAmountMinor: null,
    })
    const queued = await mutations()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ entity: 'expense', op: 'upsert', id: saved.id })
    expect(queued[0]!.changes).toEqual({
      categoryId: 'cat-food',
      amountMinor: 4500,
      currency: 'THB',
      spentOn: '2027-01-21',
      paidByTravellerId: null,
      needsDetails: true,
    })
  })

  it('an expense in the base currency counts at once at rate 1', async () => {
    const saved = await TestBed.inject(MoneyStore).addQuick({ ...quick, currency: 'aud' })

    expect(await db.expenses.get(saved.id)).toMatchObject({
      currency: 'AUD',
      fxRate: '1',
      fxSource: 'identity',
      baseAmountMinor: 4500,
    })
  })

  it('quick expense works offline and syncs once', async () => {
    const saved = await TestBed.inject(MoneyStore).addQuick(quick)
    const [entry] = await db.outbox.toArray()
    const sync = TestBed.inject(SyncService)

    // No network: the attempt gets no answer and the expense stays queued on the device.
    api.failNextPushWith(new TypeError('Failed to fetch'))
    await sync.push()
    expect(await db.outbox.get(entry.id)).toMatchObject({ state: 'pending', attempts: 1 })
    expect((await db.expenses.get(saved.id))?.syncState).toBe('pending')

    // Back online after the backoff: sent once, and a second drain sends nothing.
    clock.advance(60_000)
    const before = api.pushedIds().length
    await sync.push()
    await sync.push()

    expect(api.pushedIds().slice(before)).toEqual([entry.id])
    expect(await db.outbox.count()).toBe(0)
  })

  it('a typed rate is sent as manual and converts on the device; a new day without one drops it', async () => {
    await db.expenses.put(
      expenseRecord({
        id: 'x1',
        currency: 'THB',
        amountMinor: 33750,
        fxRate: null,
        baseAmountMinor: null,
      })
    )
    const store = TestBed.inject(MoneyStore)

    await store.update('x1', { fxRate: '22.5', description: 'Night market' }, 'AUD')
    expect(await db.expenses.get('x1')).toMatchObject({
      fxRate: '22.5',
      fxSource: 'manual',
      baseAmountMinor: 1500,
      needsDetails: false,
      description: 'Night market',
    })

    await store.update('x1', { spentOn: '2027-01-22', fxRate: null }, 'AUD')
    expect(await db.expenses.get('x1')).toMatchObject({ fxRate: null, baseAmountMinor: null })
    const last = (await mutations()).at(-1)!
    expect(last.changes).toMatchObject({ spentOn: '2027-01-22', fxRate: null, fxSource: null })
  })

  it('a delete is queued and undo brings the expense back as a new row', async () => {
    await db.expenses.put(expenseRecord({ id: 'x1', description: 'Ferry' }))
    const store = TestBed.inject(MoneyStore)

    const removed = await store.remove('x1')
    expect(await db.expenses.get('x1')).toBeUndefined()
    const restored = await store.restore(removed)

    expect(restored.id).not.toBe('x1')
    expect(await db.expenses.get(restored.id)).toMatchObject({ description: 'Ferry' })
    expect((await mutations()).map((mutation) => mutation?.op)).toEqual(['delete', 'upsert'])
  })

  it('a quick expense with a split writes its shares and sends them with the expense', async () => {
    const saved = await TestBed.inject(MoneyStore).addQuick({
      ...quick,
      currency: 'AUD',
      paidByTravellerId: 'v1',
      shares: [
        { travellerId: 'v1', shareMinor: 2250 },
        { travellerId: 'v2', shareMinor: 2250 },
      ],
    })

    const stored = await db.expenseShares.where('expenseId').equals(saved.id).toArray()
    expect(stored.map((row) => [row.travellerId, row.shareMinor]).sort()).toEqual([
      ['v1', 2250],
      ['v2', 2250],
    ])
    const [queued] = await mutations()
    expect(queued!.changes['shares']).toEqual(
      stored.map((row) => ({
        id: row.id,
        travellerId: row.travellerId,
        shareMinor: row.shareMinor,
      }))
    )
  })

  it('a new split replaces the shares of the expense as a whole', async () => {
    await db.expenses.put(expenseRecord({ id: 'x1', amountMinor: 4500, paidByTravellerId: 'v1' }))
    await db.expenseShares.bulkPut([
      {
        id: 's1',
        tripId: 'trip-1',
        expenseId: 'x1',
        travellerId: 'v1',
        shareMinor: 2250,
        updatedAt: 'x',
      },
      {
        id: 's2',
        tripId: 'trip-1',
        expenseId: 'x1',
        travellerId: 'v2',
        shareMinor: 2250,
        updatedAt: 'x',
      },
    ])

    await TestBed.inject(MoneyStore).update('x1', {}, 'AUD', {
      paidByTravellerId: 'v2',
      shares: [{ travellerId: 'v3', shareMinor: 4500 }],
    })

    const shares = await db.expenseShares.where('expenseId').equals('x1').toArray()
    expect(shares.map((row) => [row.travellerId, row.shareMinor])).toEqual([['v3', 4500]])
    expect((await db.expenses.get('x1'))?.paidByTravellerId).toBe('v2')
    const last = (await mutations()).at(-1)!
    expect(last.changes).toMatchObject({
      paidByTravellerId: 'v2',
      shares: [{ id: shares[0]!.id, travellerId: 'v3', shareMinor: 4500 }],
    })
  })

  it('a new amount splits again equally between the same people, so the split still adds up', async () => {
    await db.expenses.put(expenseRecord({ id: 'x1', amountMinor: 4500, paidByTravellerId: 'v2' }))
    await db.expenseShares.bulkPut([
      {
        id: 's1',
        tripId: 'trip-1',
        expenseId: 'x1',
        travellerId: 'v1',
        shareMinor: 1000,
        updatedAt: 'x',
      },
      {
        id: 's2',
        tripId: 'trip-1',
        expenseId: 'x1',
        travellerId: 'v2',
        shareMinor: 3500,
        updatedAt: 'x',
      },
    ])

    await TestBed.inject(MoneyStore).update('x1', { amountMinor: 1001 }, 'AUD')

    const shares = await db.expenseShares.where('expenseId').equals('x1').toArray()
    expect(shares.map((row) => [row.travellerId, row.shareMinor]).sort()).toEqual([
      ['v1', 500],
      ['v2', 501],
    ])
    const last = (await mutations()).at(-1)!
    expect(last.changes['shares']).toHaveLength(2)
  })

  it('undo of a delete brings the split back with the expense', async () => {
    await db.expenses.put(expenseRecord({ id: 'x1', amountMinor: 4500, paidByTravellerId: 'v1' }))
    await db.expenseShares.put({
      id: 's1',
      tripId: 'trip-1',
      expenseId: 'x1',
      travellerId: 'v2',
      shareMinor: 4500,
      updatedAt: 'x',
    })
    const store = TestBed.inject(MoneyStore)

    const removed = await store.remove('x1')
    expect(await db.expenseShares.count()).toBe(0)
    const restored = await store.restore(removed)

    const shares = await db.expenseShares.where('expenseId').equals(restored.id).toArray()
    expect(shares.map((row) => [row.travellerId, row.shareMinor])).toEqual([['v2', 4500]])
    expect((await mutations()).at(-1)!.changes['shares']).toHaveLength(1)
  })

  it('settling a pair records a base-currency expense the debtor paid for the creditor', async () => {
    const settled = await TestBed.inject(MoneyStore).settle({
      tripId: 'trip-1',
      baseCurrency: 'AUD',
      fromTravellerId: 'v2',
      toTravellerId: 'v1',
      amountMinor: 4500,
      categoryId: 'cat-other',
      spentOn: '2027-01-21',
      description: 'Settle up',
    })

    expect(await db.expenses.get(settled.id)).toMatchObject({
      amountMinor: 4500,
      currency: 'AUD',
      baseAmountMinor: 4500,
      paidByTravellerId: 'v2',
      categoryId: 'cat-other',
      description: 'Settle up',
      needsDetails: false,
    })
    const shares = await db.expenseShares.where('expenseId').equals(settled.id).toArray()
    expect(shares.map((row) => [row.travellerId, row.shareMinor])).toEqual([['v1', 4500]])
  })

  it('category and trip budgets are written through the outbox', async () => {
    const store = TestBed.inject(MoneyStore)

    await store.setCategoryBudget('cat-food', 30000)
    await store.setTripBudget('trip-1', 150000)

    expect((await db.budgetCategories.get('cat-food'))?.budgetMinor).toBe(30000)
    expect((await db.trips.get('trip-1'))?.budgetTotalMinor).toBe(150000)
    expect((await mutations()).map((mutation) => [mutation?.entity, mutation?.changes])).toEqual([
      ['budget_category', { budgetMinor: 30000 }],
      ['trip', { budgetTotalMinor: 150000 }],
    ])
  })
})
