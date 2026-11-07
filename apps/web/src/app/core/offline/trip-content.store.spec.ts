import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import { FakeSyncApi } from '../../../testing/fake-sync-api'
import {
  DEMO_TRIP_ID,
  DEMO_TRIP_RECORD,
  blankSegment,
  placedEvent,
} from '../../../testing/fake-trip-content'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from './db'
import { toEventRecord } from './event-record'
import { toSegmentRecord } from './segment-record'
import { TripContentStore } from './trip-content.store'

describe('TripContentStore', () => {
  let db: MonkiTripsDb
  let clock: TestClock
  let api: FakeSyncApi
  let store: TripContentStore

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    db = freshOfflineDb()
    clock = new TestClock()
    api = new FakeSyncApi()
    TestBed.configureTestingModule({ providers: provideOfflineTesting({ db, clock, api }) })
    store = TestBed.inject(TripContentStore)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  it('a new event is on the device at once, pending, with its instants derived', async () => {
    await store.upsert({
      tripId: DEMO_TRIP_ID,
      entity: 'event',
      id: 'e1',
      changes: {
        kind: 'train',
        title: 'Night train',
        status: 'booked',
        startsLocal: '2027-01-21T20:30',
        startTz: 'Asia/Bangkok',
        endsLocal: '2027-01-22T07:15',
      },
    })

    expect(await db.events.get('e1')).toMatchObject({
      tripId: DEMO_TRIP_ID,
      kind: 'train',
      startsAt: '2027-01-21T13:30:00.000Z',
      startsOn: '2027-01-21',
      endsAt: '2027-01-22T00:15:00.000Z',
      syncState: 'pending',
      updatedAt: clock.now,
    })
    const [entry] = await db.outbox.toArray()
    expect(entry).toMatchObject({
      tripId: DEMO_TRIP_ID,
      kind: 'event.upsert',
      payload: {
        entity: 'event',
        op: 'upsert',
        id: 'e1',
        changes: { kind: 'train', title: 'Night train' },
        changedAt: clock.now,
      },
    })
    await vi.waitFor(() => expect(api.pushedIds()).toEqual([entry.id]))
  })

  it('an edit keeps the other fields and queues only what changed', async () => {
    await db.events.put(
      toEventRecord(placedEvent('2027-01-21T10:00', 'Asia/Bangkok', { id: 'e1' }))
    )

    await store.upsert({
      tripId: DEMO_TRIP_ID,
      entity: 'event',
      id: 'e1',
      changes: { title: 'Renamed' },
    })

    expect(await db.events.get('e1')).toMatchObject({
      title: 'Renamed',
      startsOn: '2027-01-21',
      syncState: 'pending',
    })
    const [entry] = await db.outbox.toArray()
    expect(entry.payload).toMatchObject({ changes: { title: 'Renamed' } })
  })

  it('a leg sets the start and end of its event', async () => {
    await db.events.put(
      toEventRecord(placedEvent('2027-01-21T10:00', 'Asia/Bangkok', { id: 'e1', kind: 'flight' }))
    )

    await store.upsert({
      tripId: DEMO_TRIP_ID,
      entity: 'segment',
      id: 'g1',
      changes: {
        eventId: 'e1',
        position: 1,
        departsLocal: '2027-01-22T09:30',
        departsTz: 'Asia/Bangkok',
        arrivesLocal: '2027-01-22T17:10',
        arrivesTz: 'Asia/Tokyo',
      },
    })

    expect(await db.segments.get('g1')).toMatchObject({
      departsAt: '2027-01-22T02:30:00.000Z',
      arrivesAt: '2027-01-22T08:10:00.000Z',
    })
    expect(await db.events.get('e1')).toMatchObject({
      startsLocal: '2027-01-22T09:30',
      startsOn: '2027-01-22',
      endsLocal: '2027-01-22T17:10',
      endTz: 'Asia/Tokyo',
    })
  })

  it('a trip edit maps the wire fields onto the device row', async () => {
    await db.trips.put(DEMO_TRIP_RECORD)

    await store.upsert({
      tripId: DEMO_TRIP_ID,
      entity: 'trip',
      id: DEMO_TRIP_ID,
      changes: { name: 'Hills only', endsOn: '2027-01-30', budgetTotalMinor: 50_000 },
    })

    expect(await db.trips.get(DEMO_TRIP_ID)).toMatchObject({
      name: 'Hills only',
      endDate: '2027-01-30',
      budgetTotalMinor: 50_000,
      syncState: 'pending',
    })
  })

  it('removing an event takes its legs with it and queues one delete', async () => {
    await db.events.put(
      toEventRecord(placedEvent('2027-01-21T10:00', 'Asia/Bangkok', { id: 'e1' }))
    )
    await db.segments.put(toSegmentRecord(blankSegment({ id: 'g1', eventId: 'e1' })))

    await store.remove({ tripId: DEMO_TRIP_ID, entity: 'event', id: 'e1' })

    expect(await db.events.get('e1')).toBeUndefined()
    expect(await db.segments.get('g1')).toBeUndefined()
    expect(await db.outbox.toArray()).toMatchObject([
      { kind: 'event.delete', payload: { entity: 'event', op: 'delete', id: 'e1' } },
    ])
  })

  it('a delete with undo leaves the device first and the outbox only when the window closes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await db.events.put(
      toEventRecord(placedEvent('2027-01-21T10:00', 'Asia/Bangkok', { id: 'e1' }))
    )

    const deferred = await store.removeWithUndo(
      { tripId: DEMO_TRIP_ID, entity: 'event', id: 'e1' },
      8000
    )

    expect(await db.events.get('e1')).toBeUndefined()
    expect(await db.outbox.count()).toBe(0)

    await deferred.undo()
    expect(await db.events.get('e1')).toMatchObject({ id: 'e1' })
    vi.advanceTimersByTime(8000)
    expect(await db.outbox.count()).toBe(0)
    vi.useRealTimers()
  })

  it('a delete with undo reaches the outbox once the window closed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await db.events.put(
      toEventRecord(placedEvent('2027-01-21T10:00', 'Asia/Bangkok', { id: 'e1' }))
    )

    const deferred = await store.removeWithUndo(
      { tripId: DEMO_TRIP_ID, entity: 'event', id: 'e1' },
      8000
    )
    vi.advanceTimersByTime(8000)
    vi.useRealTimers()

    // The queued delete is sent at once (the device is online) and the server applies it.
    await vi.waitFor(() => expect(api.pushedIds()).toHaveLength(1))
    await deferred.undo()
    expect(await db.events.get('e1')).toBeUndefined()
    expect(await db.outbox.count()).toBe(0)
  })
})
