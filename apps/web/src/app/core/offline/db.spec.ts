import 'fake-indexeddb/auto'
import { Dexie } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { freshOfflineDb } from '../../../testing/offline-testing'
import { MonkiTripsDb } from './db'
import { blankEvent } from '../../../testing/fake-trip-content'

describe('MonkiTripsDb', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    db = freshOfflineDb()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('is called monki-trips and opens at version 5 (money since WP 2.2)', async () => {
    await db.open()

    expect(db.name).toBe('monki-trips')
    expect(db.verno).toBe(5)
  })

  it('holds exactly the offline tables of the plan plus travellers, the activity cache and emergency info', async () => {
    await db.open()

    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        'activity',
        'budgetCategories',
        'checklist',
        'docBlobs',
        'docs',
        'emergency',
        'events',
        'expenses',
        'members',
        'meta',
        'outbox',
        'seats',
        'segments',
        'stays',
        'stops',
        'tasks',
        'travellers',
        'trips',
      ].sort()
    )
  })

  it('a version 1 database keeps its rows when the app opens it at the current version', async () => {
    const indexedDB = new IDBFactory()
    const v1 = new Dexie('monki-trips', { indexedDB, IDBKeyRange })
    v1.version(1).stores({ trips: 'id, updatedAt', meta: 'key', outbox: 'id, state, createdAt' })
    await v1.table('trips').put({ id: 't1', name: 'Kept', updatedAt: 'x' })
    v1.close()

    const upgraded = new MonkiTripsDb({ indexedDB, IDBKeyRange })
    await upgraded.open()

    expect(upgraded.verno).toBe(5)
    expect((await upgraded.trips.get('t1'))?.name).toBe('Kept')
    expect(await upgraded.travellers.count()).toBe(0)
    expect(await upgraded.emergency.count()).toBe(0)
    upgraded.close()
  })

  it('a version 2 database keeps its travellers when the app opens it at version 3', async () => {
    const indexedDB = new IDBFactory()
    const v2 = new Dexie('monki-trips', { indexedDB, IDBKeyRange })
    v2.version(1).stores({ trips: 'id, updatedAt', meta: 'key', outbox: 'id, state, createdAt' })
    v2.version(2).stores({
      travellers: 'id, tripId, updatedAt',
      activity: 'id, tripId, [tripId+createdAt]',
    })
    await v2.table('travellers').put({
      id: 'tr1',
      tripId: 't1',
      displayName: 'Kept',
      userId: null,
      position: 0,
      updatedAt: 'x',
    })
    v2.close()

    const upgraded = new MonkiTripsDb({ indexedDB, IDBKeyRange })
    await upgraded.open()

    expect(upgraded.verno).toBe(5)
    expect((await upgraded.travellers.get('tr1'))?.displayName).toBe('Kept')
    expect(await upgraded.emergency.count()).toBe(0)
    upgraded.close()
  })

  it('keys each table and indexes it as the contract says', async () => {
    await db.open()
    const schema = (name: string) => {
      const table = db.table(name).schema
      return [table.primKey.name, ...table.indexes.map((index) => index.name)]
    }

    expect(schema('trips')).toEqual(['id', 'updatedAt'])
    expect(schema('events')).toEqual(['id', 'tripId', '[tripId+startsOn]', 'updatedAt'])
    expect(schema('stops')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('segments')).toEqual(['id', 'tripId', 'eventId', 'updatedAt'])
    expect(schema('seats')).toEqual(['id', 'tripId', 'segmentId', 'updatedAt'])
    expect(schema('stays')).toEqual(['id', 'tripId', '[tripId+night]', 'updatedAt'])
    expect(schema('docs')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('docBlobs')).toEqual(['docId'])
    expect(schema('tasks')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('checklist')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('expenses')).toEqual(['id', 'tripId', '[tripId+spentOn]', 'updatedAt'])
    expect(schema('budgetCategories')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('members')).toEqual(['id', 'tripId', 'userId', '[tripId+userId]'])
    expect(schema('travellers')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('activity')).toEqual(['id', 'tripId', '[tripId+createdAt]'])
    expect(schema('emergency')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('meta')).toEqual(['key'])
    expect(schema('outbox')).toEqual(['id', 'state', 'createdAt'])
  })

  it('finds the events of one trip day through the compound index on the local start date', async () => {
    await db.events.bulkPut([
      blankEvent({ id: 'e1', tripId: 't1', startsOn: '2027-01-15', title: 'Flight' }),
      blankEvent({ id: 'e2', tripId: 't1', startsOn: '2027-01-16', title: 'Museum' }),
      blankEvent({ id: 'e3', tripId: 't2', startsOn: '2027-01-15', title: 'Other trip' }),
    ])

    const day = await db.events.where('[tripId+startsOn]').equals(['t1', '2027-01-15']).toArray()

    expect(day.map((event) => event.id)).toEqual(['e1'])
  })

  it('opening a version 4 database keeps its meta: the sync service, not the upgrade, forces the full pull', async () => {
    const indexedDB = new IDBFactory()
    const v4 = new Dexie('monki-trips', { indexedDB, IDBKeyRange })
    v4.version(4).stores({ trips: 'id, updatedAt', meta: 'key', outbox: 'id, state, createdAt' })
    await v4.table('meta').bulkPut([
      { key: 'sync.cursor', value: 'old-cursor' },
      { key: 'trip.active', value: 't1' },
    ])
    v4.close()

    const upgraded = new MonkiTripsDb({ indexedDB, IDBKeyRange })
    await upgraded.open()

    expect(await upgraded.meta.get('sync.cursor')).toEqual({
      key: 'sync.cursor',
      value: 'old-cursor',
    })
    expect(await upgraded.meta.get('trip.active')).toEqual({ key: 'trip.active', value: 't1' })
    upgraded.close()
  })

  it('stores a document blob next to its hash', async () => {
    const blob = new Blob(['%PDF-synthetic'], { type: 'application/pdf' })
    await db.docBlobs.put({
      docId: 'd1',
      sha256: 'abc',
      size: blob.size,
      mime: 'application/pdf',
      blob,
      savedAt: '2026-11-07T12:00:00.000Z',
    })

    const saved = await db.docBlobs.get('d1')

    expect(saved?.sha256).toBe('abc')
    expect(saved?.size).toBe(blob.size)
  })

  it('two fresh databases in one spec never share rows', async () => {
    const other = freshOfflineDb()
    await db.meta.put({ key: 'k', value: 1 })

    expect(await other.meta.get('k')).toBeUndefined()
    await other.delete()
  })
})
