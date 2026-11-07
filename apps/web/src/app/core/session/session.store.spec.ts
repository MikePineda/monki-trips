import { TestBed } from '@angular/core/testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from '../offline/db'
import { META_SESSION, MetaStore } from '../offline/meta.store'
import { OnlineStore } from '../offline/online.store'
import { FAKE_SESSION_USER, FakeSessionApi, SESSION_API } from './session-api'
import { SessionStore } from './session.store'

describe('SessionStore', () => {
  let db: MonkiTripsDb
  let api: FakeSessionApi

  beforeEach(() => {
    db = freshOfflineDb()
    api = new FakeSessionApi()
    TestBed.configureTestingModule({
      providers: [...provideOfflineTesting({ db }), { provide: SESSION_API, useValue: api }],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  function goOffline() {
    const online = TestBed.inject(OnlineStore)
    vi.spyOn(online, 'online').mockReturnValue(false)
  }

  it('with no cache and network it asks the server and caches the answer', async () => {
    const store = TestBed.inject(SessionStore)

    const user = await store.restore()

    expect(user).toEqual(FAKE_SESSION_USER)
    expect(store.state()).toBe('signed-in')
    expect(await TestBed.inject(MetaStore).get(META_SESSION)).toEqual(FAKE_SESSION_USER)
  })

  it('a cached session answers at once, even without network', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, { id: 'u1', displayName: 'Cached' })
    goOffline()
    const store = TestBed.inject(SessionStore)

    const user = await store.restore()

    expect(user?.id).toBe('u1')
    expect(store.signedIn()).toBe(true)
    expect(api.calls).toEqual([])
  })

  it('with a cache and network it refreshes in the background', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, { id: 'u1', displayName: 'Cached' })
    const store = TestBed.inject(SessionStore)

    const user = await store.restore()

    expect(user?.id).toBe('u1')
    await vi.waitFor(() => expect(store.user()?.id).toBe(FAKE_SESSION_USER.id))
  })

  it('a 401 with network clears the session', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, { id: 'u1', displayName: 'Cached' })
    api.user = null
    const store = TestBed.inject(SessionStore)

    await store.refresh()

    expect(store.state()).toBe('anonymous')
    expect(await TestBed.inject(MetaStore).get(META_SESSION)).toBeUndefined()
  })

  it('a network failure keeps the cached session', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, { id: 'u1', displayName: 'Cached' })
    goOffline()
    const store = TestBed.inject(SessionStore)
    await store.restore()

    api.failWith = new TypeError('fetch failed')
    await expect(store.refresh()).rejects.toThrow('fetch failed')

    expect(store.user()?.id).toBe('u1')
    expect(store.signedIn()).toBe(true)
  })

  it('offline with no cache is anonymous without asking the server', async () => {
    goOffline()
    const store = TestBed.inject(SessionStore)

    expect(await store.restore()).toBeNull()
    expect(store.state()).toBe('anonymous')
    expect(api.calls).toEqual([])
  })

  it('restore runs once and later callers share it', async () => {
    const store = TestBed.inject(SessionStore)

    await Promise.all([store.restore(), store.restore()])
    await store.restore()

    expect(api.calls).toEqual(['me'])
  })
})
