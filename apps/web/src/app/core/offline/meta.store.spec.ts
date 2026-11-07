import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from './db'
import { META_ACTIVE_TRIP, META_CURSOR, MetaStore } from './meta.store'

describe('MetaStore', () => {
  let db: MonkiTripsDb
  let store: MetaStore

  beforeEach(() => {
    db = freshOfflineDb()
    TestBed.configureTestingModule({ providers: provideOfflineTesting({ db }) })
    store = TestBed.inject(MetaStore)
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  it('an unknown key reads as undefined', async () => {
    expect(await store.get(META_CURSOR)).toBeUndefined()
  })

  it('remembers a value under its key', async () => {
    await store.set(META_CURSOR, 'c-1')
    await store.set(META_ACTIVE_TRIP, { id: 't1' })

    expect(await store.get<string>(META_CURSOR)).toBe('c-1')
    expect(await store.get(META_ACTIVE_TRIP)).toEqual({ id: 't1' })
  })

  it('a removed key reads as undefined again', async () => {
    await store.set(META_CURSOR, 'c-1')

    await store.remove(META_CURSOR)

    expect(await store.get(META_CURSOR)).toBeUndefined()
  })

  it('a watched key follows every write and falls back when removed', async () => {
    const cursor = store.watch<string | null>(META_CURSOR, null)
    expect(cursor()).toBeNull()

    await store.set(META_CURSOR, 'c-2')
    await vi.waitFor(() => expect(cursor()).toBe('c-2'))

    await store.remove(META_CURSOR)
    await vi.waitFor(() => expect(cursor()).toBeNull())
  })
})
