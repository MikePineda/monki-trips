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
import {
  META_ACTIVE_TRIP,
  META_APP_VERSION,
  META_CURSOR,
  META_DEVICE_USER,
  META_SESSION,
  MetaStore,
} from '../offline/meta.store'
import { OnlineStore } from '../offline/online.store'
import { FAKE_SESSION_USER } from '../../../testing/fake-session-api'
import { ForeignChangesError } from './foreign-changes.error'
import { SessionStore } from './session.store'

const CACHED = { ...FAKE_SESSION_USER, id: 'u1', displayName: 'Cached' }
const SOLO_TRIP = {
  id: 'trip-1',
  name: 'Sample',
  startDate: '2027-01-20',
  endDate: '2027-02-06',
  baseCurrency: 'EUR',
  updatedAt: '2026-11-07T00:00:00.000Z',
}

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

  it('after signing in, restore answers the new session instead of the earlier anonymous one', async () => {
    fakes.session.user = null
    const store = TestBed.inject(SessionStore)
    expect(await store.restore()).toBeNull()

    await store.login({ email: 'owner@example.com', password: 'correct horse' })

    expect((await store.restore())?.email).toBe('owner@example.com')
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

  it('sign-out keeps the session when the server fails', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    await db.trips.put(SOLO_TRIP)
    const store = TestBed.inject(SessionStore)
    await store.restore()
    fakes.session.failWith = new ApiFailure({
      kind: 'http',
      status: 502,
      message: 'Request failed with status code 502',
    })

    await expect(store.signOut()).rejects.toMatchObject({ status: 502 })

    expect(store.signedIn()).toBe(true)
    expect(await db.trips.count()).toBe(1)
    expect(await TestBed.inject(MetaStore).get(META_SESSION)).toEqual(CACHED)
  })

  it('a session the server already ended (401) still signs out on the device', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    const store = TestBed.inject(SessionStore)
    await store.restore()
    fakes.session.failWith = new ApiFailure({
      kind: 'http',
      status: 401,
      code: 'E_UNAUTHORIZED',
      message: 'x',
    })

    await store.signOut()

    expect(store.state()).toBe('anonymous')
  })

  it('a stale CSRF token is refreshed and the sign-out sent once more', async () => {
    await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
    const store = TestBed.inject(SessionStore)
    await store.restore()
    await vi.waitFor(() => expect(fakes.session.calls).toEqual(['me']))
    fakes.session.failWith = new ApiFailure({
      kind: 'http',
      status: 403,
      code: 'E_BAD_CSRF_TOKEN',
      message: 'x',
    })

    await store.signOut()

    expect(fakes.session.calls).toEqual(['me', 'logout', 'me', 'logout'])
    expect(store.state()).toBe('anonymous')
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

  describe('one device, several accounts', () => {
    /** The first account used the device, then its session ended (401) with the data kept. */
    async function previousAccountExpired(): Promise<SessionStore> {
      const meta = TestBed.inject(MetaStore)
      await meta.set(META_SESSION, CACHED)
      await meta.set(META_DEVICE_USER, CACHED.id)
      await meta.set(META_CURSOR, 'cursor-of-u1')
      await meta.set(META_ACTIVE_TRIP, SOLO_TRIP.id)
      await meta.set(META_APP_VERSION, { version: '0.1.0', sha: 'abc1234' })
      await db.trips.put(SOLO_TRIP)
      await db.members.put({
        id: 'm1',
        tripId: SOLO_TRIP.id,
        userId: CACHED.id,
        role: 'owner',
        updatedAt: 'x',
      })
      fakes.session.user = CACHED
      const store = TestBed.inject(SessionStore)
      await store.refresh()
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
      await store.expire('/trips')
      return store
    }

    function pendingChange(id = 'outbox-1') {
      return db.outbox.put({
        id,
        tripId: SOLO_TRIP.id,
        kind: 'expense.create',
        payload: {},
        state: 'failed',
        attempts: 1,
        createdAt: '2026-11-07T00:00:00.000Z',
        nextAttemptAt: null,
        error: 'refused',
      })
    }

    it('an expired session keeps the device copy, still owned by its account', async () => {
      await previousAccountExpired()

      expect(await db.trips.count()).toBe(1)
      expect(await TestBed.inject(MetaStore).get(META_DEVICE_USER)).toBe(CACHED.id)
    })

    it('the same account signing in again keeps its device copy', async () => {
      const store = await previousAccountExpired()
      fakes.session.loginAs = CACHED

      await store.login({ email: CACHED.email, password: 'correct horse' })

      expect(await db.trips.count()).toBe(1)
      expect(await TestBed.inject(MetaStore).get(META_CURSOR)).toBe('cursor-of-u1')
    })

    it("a different user signing in never sees the previous user's trips", async () => {
      const store = await previousAccountExpired()

      await store.login({ email: 'partner@example.com', password: 'correct horse' })

      expect(store.user()?.email).toBe('partner@example.com')
      expect(await db.trips.count()).toBe(0)
      expect(await db.members.count()).toBe(0)
      const meta = TestBed.inject(MetaStore)
      expect(await meta.get(META_ACTIVE_TRIP)).toBeUndefined()
      expect(await meta.get(META_DEVICE_USER)).toBe(FAKE_SESSION_USER.id)
      // Facts about the device itself stay.
      expect(await meta.get(META_APP_VERSION)).toEqual({ version: '0.1.0', sha: 'abc1234' })
    })

    it('sync cursor is reset when the device user changes', async () => {
      const store = await previousAccountExpired()

      await store.login({ email: 'partner@example.com', password: 'correct horse' })

      expect(await TestBed.inject(MetaStore).get(META_CURSOR)).toBeUndefined()
    })

    it('a signup on a device another account used starts from a clean copy too', async () => {
      const store = await previousAccountExpired()

      await store.setUser({ ...FAKE_SESSION_USER, id: 'new-user', email: 'new@example.com' })

      expect(await db.trips.count()).toBe(0)
    })

    it('unsynced changes of another account block the sign-in until the person decides', async () => {
      const store = await previousAccountExpired()
      await pendingChange()

      const refused = store.login({ email: 'partner@example.com', password: 'correct horse' })

      await expect(refused).rejects.toBeInstanceOf(ForeignChangesError)
      await expect(refused).rejects.toMatchObject({ count: 1 })
      expect(store.signedIn()).toBe(false)
      expect(await db.trips.count()).toBe(1)
      expect(await db.outbox.count()).toBe(1)
    })

    it("discarding the other account's changes signs in on a clean device", async () => {
      const store = await previousAccountExpired()
      await pendingChange()
      const error = (await store
        .login({ email: 'partner@example.com', password: 'correct horse' })
        .then(
          () => null,
          (caught: unknown) => caught
        )) as ForeignChangesError

      await store.discardForeignChanges(error.user)

      expect(store.user()?.email).toBe('partner@example.com')
      expect(await db.outbox.count()).toBe(0)
      expect(await db.trips.count()).toBe(0)
      expect(await TestBed.inject(MetaStore).get(META_DEVICE_USER)).toBe(FAKE_SESSION_USER.id)
    })

    it("keeping the other account's changes signs the new account out again", async () => {
      const store = await previousAccountExpired()
      await pendingChange()
      await store
        .login({ email: 'partner@example.com', password: 'correct horse' })
        .catch(() => undefined)

      await store.abandonSignIn()

      expect(fakes.session.calls).toContain('logout')
      expect(store.signedIn()).toBe(false)
      expect(await db.outbox.count()).toBe(1)
    })

    it('a device written before owners were recorded is adopted by its cached session', async () => {
      await TestBed.inject(MetaStore).set(META_SESSION, CACHED)
      await db.trips.put(SOLO_TRIP)
      goOffline()
      const store = TestBed.inject(SessionStore)

      await store.restore()

      expect(await TestBed.inject(MetaStore).get(META_DEVICE_USER)).toBe(CACHED.id)
      expect(await db.trips.count()).toBe(1)
    })
  })
})
