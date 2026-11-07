import 'fake-indexeddb/auto'
import { Dexie } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { freshOfflineDb } from '../../../testing/offline-testing'
import { MonkiTripsDb } from './db'

describe('MonkiTripsDb', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    db = freshOfflineDb()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('is called monki-trips and opens at version 2', async () => {
    await db.open()

    expect(db.name).toBe('monki-trips')
    expect(db.verno).toBe(2)
  })

  it('holds exactly the offline tables of the plan plus travellers and the activity cache', async () => {
    await db.open()

    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        'activity',
        'checklist',
        'docBlobs',
        'docs',
        'events',
        'expenses',
        'members',
        'meta',
        'outbox',
        'stays',
        'tasks',
        'travellers',
        'trips',
      ].sort()
    )
  })

  it('a version 1 database keeps its rows when the app opens it at version 2', async () => {
    const indexedDB = new IDBFactory()
    const v1 = new Dexie('monki-trips', { indexedDB, IDBKeyRange })
    v1.version(1).stores({ trips: 'id, updatedAt', meta: 'key', outbox: 'id, state, createdAt' })
    await v1.table('trips').put({ id: 't1', name: 'Kept', updatedAt: 'x' })
    v1.close()

    const upgraded = new MonkiTripsDb({ indexedDB, IDBKeyRange })
    await upgraded.open()

    expect(upgraded.verno).toBe(2)
    expect((await upgraded.trips.get('t1'))?.name).toBe('Kept')
    expect(await upgraded.travellers.count()).toBe(0)
    upgraded.close()
  })

  it('keys each table and indexes it as the contract says', async () => {
    await db.open()
    const schema = (name: string) => {
      const table = db.table(name).schema
      return [table.primKey.name, ...table.indexes.map((index) => index.name)]
    }

    expect(schema('trips')).toEqual(['id', 'updatedAt'])
    expect(schema('events')).toEqual(['id', 'tripId', '[tripId+day]', 'updatedAt'])
    expect(schema('stays')).toEqual(['id', 'tripId', '[tripId+night]', 'updatedAt'])
    expect(schema('docs')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('docBlobs')).toEqual(['docId'])
    expect(schema('tasks')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('checklist')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('expenses')).toEqual(['id', 'tripId', '[tripId+date]', 'updatedAt'])
    expect(schema('members')).toEqual(['id', 'tripId', 'userId', '[tripId+userId]'])
    expect(schema('travellers')).toEqual(['id', 'tripId', 'updatedAt'])
    expect(schema('activity')).toEqual(['id', 'tripId', '[tripId+createdAt]'])
    expect(schema('meta')).toEqual(['key'])
    expect(schema('outbox')).toEqual(['id', 'state', 'createdAt'])
  })

  it('finds the events of one trip day through the compound index', async () => {
    await db.events.bulkPut([
      { id: 'e1', tripId: 't1', day: '2027-01-15', title: 'Flight', updatedAt: 'x' },
      { id: 'e2', tripId: 't1', day: '2027-01-16', title: 'Museum', updatedAt: 'x' },
      { id: 'e3', tripId: 't2', day: '2027-01-15', title: 'Other trip', updatedAt: 'x' },
    ])

    const day = await db.events.where('[tripId+day]').equals(['t1', '2027-01-15']).toArray()

    expect(day.map((event) => event.id)).toEqual(['e1'])
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
