import { TestBed } from '@angular/core/testing'
import type { Traveller } from '@monkitrips/shared'
import {
  TEST_NOW,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from './db'
import { TravellersStore, type TravellerMutationPayload } from './travellers.store'

function traveller(overrides: Partial<Traveller> = {}): Traveller {
  return {
    id: 'tv-1',
    tripId: 'trip-1',
    displayName: 'Owner',
    userId: 'owner-user',
    position: 0,
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('TravellersStore', () => {
  let db: MonkiTripsDb
  let store: TravellersStore

  beforeEach(() => {
    db = freshOfflineDb()
    TestBed.configureTestingModule({ providers: provideOfflineTesting({ db }) })
    store = TestBed.inject(TravellersStore)
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  async function payloads(): Promise<TravellerMutationPayload[]> {
    return (await db.outbox.toArray()).map((entry) => entry.payload as TravellerMutationPayload)
  }

  it('a traveller without an account is added at the end, pending, with an upsert in the outbox', async () => {
    await store.refill('trip-1', [traveller()])

    const added = await store.add('trip-1', 'Little one')

    const rows = await db.travellers.where('tripId').equals('trip-1').sortBy('position')
    expect(rows.map((row) => row.displayName)).toEqual(['Owner', 'Little one'])
    expect(rows[1]).toMatchObject({
      id: added.id,
      userId: null,
      position: 1,
      syncState: 'pending',
      updatedAt: TEST_NOW,
    })
    expect(await payloads()).toEqual([
      {
        entity: 'traveller',
        op: 'upsert',
        id: added.id,
        changes: { displayName: 'Little one', userId: null, position: 1 },
        changedAt: TEST_NOW,
      },
    ])
    expect((await db.outbox.toArray())[0]).toMatchObject({
      tripId: 'trip-1',
      kind: 'traveller.upsert',
      state: 'pending',
    })
  })

  it('a rename queues only the changed field', async () => {
    await store.refill('trip-1', [traveller()])

    await store.rename('tv-1', 'Captain')

    expect((await db.travellers.get('tv-1'))?.displayName).toBe('Captain')
    expect((await payloads())[0]).toMatchObject({
      op: 'upsert',
      id: 'tv-1',
      changes: { displayName: 'Captain' },
    })
  })

  it('a removal deletes the row on the device and queues a delete', async () => {
    await store.refill('trip-1', [
      traveller(),
      traveller({ id: 'tv-2', userId: null, position: 1 }),
    ])

    await store.remove('tv-2')

    expect(await db.travellers.get('tv-2')).toBeUndefined()
    expect((await payloads())[0]).toMatchObject({ op: 'delete', id: 'tv-2', changes: {} })
    expect((await db.outbox.toArray())[0].kind).toBe('traveller.delete')
  })

  it('a refill from the server keeps every row whose change is still in the outbox', async () => {
    await store.refill('trip-1', [
      traveller(),
      traveller({ id: 'tv-2', userId: null, position: 1 }),
    ])
    const added = await store.add('trip-1', 'Little one')
    await store.rename('tv-1', 'Captain')
    await store.remove('tv-2')

    // The server has not seen any of it yet, and lists a row the device never had.
    await store.refill('trip-1', [
      traveller(),
      traveller({ id: 'tv-2', userId: null, position: 1 }),
      traveller({ id: 'tv-3', displayName: 'Partner', userId: 'partner-user', position: 3 }),
    ])

    const rows = await db.travellers.where('tripId').equals('trip-1').sortBy('position')
    expect(rows.map((row) => [row.id, row.displayName])).toEqual([
      ['tv-1', 'Captain'],
      [added.id, 'Little one'],
      ['tv-3', 'Partner'],
    ])
  })

  it('a refill drops rows the server no longer lists and touches no other trip', async () => {
    await store.refill('trip-1', [traveller(), traveller({ id: 'tv-2', position: 1 })])
    await store.refill('trip-2', [traveller({ id: 'tv-9', tripId: 'trip-2' })])

    await store.refill('trip-1', [traveller()])

    expect((await db.travellers.toArray()).map((row) => row.id).sort()).toEqual(['tv-1', 'tv-9'])
  })
})
