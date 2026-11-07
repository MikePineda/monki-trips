import { TestBed } from '@angular/core/testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from '../../core/offline/db'
import { outboxMutation } from '../../core/offline/mutation'
import { EmergencyStore } from './emergency.store'

describe('EmergencyStore', () => {
  let db: MonkiTripsDb
  let store: EmergencyStore

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      providers: provideOfflineTesting({ db, clock: new TestClock('2026-11-07T12:00:00.000Z') }),
    })
    store = TestBed.inject(EmergencyStore)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  it('emergency fields merge per key: each save carries only the keys that changed', async () => {
    const insurance = { provider: 'Demo Assure', policyNumber: 'DEMO-1', phone: '+1 555 0100' }
    const embassy = { name: 'Consulate of Demo', phone: '+1 555 0101', address: null }

    expect(await store.save('trip-1', { contacts: [], insurance, notes: null })).toEqual([
      'insurance',
    ])
    expect(await store.save('trip-1', { contacts: [], insurance, embassy, notes: null })).toEqual([
      'embassy',
    ])
    expect(await store.save('trip-1', { contacts: [], insurance, embassy, notes: null })).toEqual(
      []
    )

    const record = await db.emergency.get('trip-1')
    expect(record).toMatchObject({
      id: 'trip-1',
      tripId: 'trip-1',
      content: { insurance, embassy },
      schemaVersion: 1,
      syncState: 'pending',
      updatedAt: '2026-11-07T12:00:00.000Z',
    })
    const queued = (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
    expect(queued).toEqual([
      expect.objectContaining({
        entity: 'emergency',
        op: 'upsert',
        id: 'trip-1',
        changes: { insurance },
      }),
      expect.objectContaining({
        entity: 'emergency',
        op: 'upsert',
        id: 'trip-1',
        changes: { embassy },
      }),
    ])
  })

  it('clearing a section sends null and drops the key on the device', async () => {
    await store.save('trip-1', {
      contacts: [],
      medical: { notes: 'allergic to demo' },
      notes: null,
    })

    expect(await store.save('trip-1', { contacts: [], notes: null })).toEqual(['medical'])

    expect((await db.emergency.get('trip-1'))?.content).toEqual({ medical: undefined })
    const last = outboxMutation((await db.outbox.toArray())[1])
    expect(last?.changes).toEqual({ medical: null })
  })
})
