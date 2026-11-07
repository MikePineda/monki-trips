import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { ApiFailure } from '../api/api-failure'
import type { MonkiTripsDb } from '../offline/db'
import { META_SESSION, MetaStore } from '../offline/meta.store'
import { OnlineStore } from '../offline/online.store'
import { FAKE_SESSION_USER } from './session-api'
import { SessionStore } from './session.store'

const CACHED = { ...FAKE_SESSION_USER, id: 'u1', displayName: 'Cached' }

describe('SessionStore', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    TestBed.configureTestingModule({
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
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
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    goOffline()
    const store = TestBed.inject(SessionStore)

    const user = await store.restore()

    expect(user?.id).toBe('u1')
    expect(store.signedIn()).toBe(true)
    expect(fakes.session.calls).toEqual([])
  })

  it('with a cache and network it refreshes in the background', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    const store = TestBed.inject(SessionStore)

    const user = await store.restore()

    expect(user?.id).toBe('u1')
    await vi.waitFor(() => expect(store.user()?.id).toBe(FAKE_SESSION_USER.id))
  })

  it('a 401 with network clears the session', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    fakes.session.user = null
    const store = TestBed.inject(SessionStore)

    await store.refresh()

    expect(store.state()).toBe('anonymous')
    expect(await TestBed.inject(MetaStore).get(META_SESSION)).toBeUndefined()
  })

  it('a network failure keeps the cached session', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    goOffline()
    const store = TestBed.inject(SessionStore)
    await store.restore()

    fakes.session.failWith = new TypeError('fetch failed')
    await expect(store.refresh()).rejects.toThrow('fetch failed')

    expect(store.user()?.id).toBe('u1')
    expect(store.signedIn()).toBe(true)
  })

  it('offline with no cache is anonymous without asking the server', async () => {
    goOffline()
    const store = TestBed.inject(SessionStore)

    expect(await store.restore()).toBeNull()
    expect(store.state()).toBe('anonymous')
    expect(fakes.session.calls).toEqual([])
  })

  it('restore runs once and later callers share it', async () => {
    const store = TestBed.inject(SessionStore)

    await Promise.all([store.restore(), store.restore()])
    await store.restore()

    expect(fakes.session.calls).toEqual(['me'])
  })

  it('signing in caches the profile the server returned', async () => {
    const store = TestBed.inject(SessionStore)

    const user = await store.login({ email: 'owner@example.com', password: 'correct horse' })

    expect(user.email).toBe('owner@example.com')
    expect(store.signedIn()).toBe(true)
    expect(await TestBed.inject(MetaStore).get(META_SESSION)).toMatchObject({
      email: 'owner@example.com',
    })
  })

  it('a refused sign-in reaches the caller and leaves the session anonymous', async () => {
    const store = TestBed.inject(SessionStore)
    fakes.session.failWith = new ApiFailure({
      kind: 'http',
      status: 401,
      code: 'E_INVALID_CREDENTIALS',
      message: 'Wrong e-mail or password',
    })

    await expect(
      store.login({ email: 'owner@example.com', password: 'nope' })
    ).rejects.toMatchObject({ code: 'E_INVALID_CREDENTIALS' })
    expect(store.signedIn()).toBe(false)
  })

  it('signing out tells the server and wipes the device copy of every trip', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    await db.trips.put({
      id: 'trip-1',
      name: 'Sample',
      startDate: '2027-01-20',
      endDate: '2027-02-06',
      baseCurrency: 'EUR',
      updatedAt: '2026-11-07T00:00:00.000Z',
    })
    const store = TestBed.inject(SessionStore)
    await store.restore()

    await store.signOut()

    expect(fakes.session.calls).toContain('logout')
    expect(store.state()).toBe('anonymous')
    expect(await db.trips.count()).toBe(0)
    expect(await TestBed.inject(MetaStore).get(META_SESSION)).toBeUndefined()
  })

  it('signing out with no answer from the server keeps the session', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    const store = TestBed.inject(SessionStore)
    await store.restore()
    fakes.session.failWith = new ApiFailure({ kind: 'network', message: 'Network error' })

    await expect(store.signOut()).rejects.toMatchObject({ kind: 'network' })

    expect(store.signedIn()).toBe(true)
  })

  it('401 online clears the session and goes to sign in with the return url', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    const store = TestBed.inject(SessionStore)
    await store.restore()
    const router = TestBed.inject(Router)
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true)
    vi.spyOn(router, 'url', 'get').mockReturnValue('/t/trip-1/money')

    const handled = await store.handleUnauthorized(
      new ApiFailure({ kind: 'http', status: 401, code: 'E_UNAUTHORIZED', message: 'x' })
    )

    expect(handled).toBe(true)
    expect(store.state()).toBe('anonymous')
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/t/trip-1/money' },
    })
  })

  it('a 401 while offline is not a sign-out: the cached session stays', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    goOffline()
    const store = TestBed.inject(SessionStore)
    await store.restore()

    const handled = await store.handleUnauthorized(
      new ApiFailure({ kind: 'http', status: 401, code: 'E_UNAUTHORIZED', message: 'x' })
    )

    expect(handled).toBe(false)
    expect(store.signedIn()).toBe(true)
  })
})
