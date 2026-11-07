import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { RouterTestingHarness } from '@angular/router/testing'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { ApiFailure } from '../api/api-failure'
import { fakeTrip } from '../../../testing/fake-trips-api'
import type { MonkiTripsDb } from '../offline/db'
import { META_ACTIVE_TRIP, META_SESSION, MetaStore } from '../offline/meta.store'
import { OnlineStore } from '../offline/online.store'
import { authGuard } from './auth.guard'
import { currentTripGuard } from './current-trip.guard'
import { FAKE_SESSION_USER } from '../../../testing/fake-session-api'
import { tripMemberGuard } from './trip-member.guard'

@Component({ template: '<p data-testid="probe.page">page</p>' })
class Page {}

describe('route guards', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    TestBed.configureTestingModule({
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(fakes),
        provideRouter([
          { path: 'login', component: Page },
          { path: 'not-found', component: Page },
          { path: 'trips', component: Page, canActivate: [authGuard] },
          { path: 't/current/add', canActivate: [currentTripGuard], children: [] },
          { path: 't/:tripId/today', component: Page, canActivate: [authGuard, tripMemberGuard] },
          { path: 't/:tripId/add', component: Page },
        ]),
      ],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  function goOffline() {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
  }

  async function visit(url: string): Promise<string> {
    const harness = await RouterTestingHarness.create()
    await harness.navigateByUrl(url)
    return TestBed.inject(Router).url
  }

  describe('authGuard', () => {
    it('lets a signed-in person through', async () => {
      expect(await visit('/trips')).toBe('/trips')
    })

    it('sends an anonymous online visitor to /login with the return url', async () => {
      fakes.session.user = null

      expect(await visit('/trips')).toBe('/login?returnUrl=%2Ftrips')
    })

    it('never redirects to /login while offline, even with no cached session', async () => {
      goOffline()

      expect(await visit('/trips')).toBe('/trips')
      expect(fakes.session.calls).toEqual([])
    })

    it('offline guard keeps the cached session', async () => {
      await TestBed.inject(MetaStore).set(META_SESSION, { ...FAKE_SESSION_USER, id: 'u1' })
      goOffline()

      expect(await visit('/trips')).toBe('/trips')
      expect(fakes.session.calls).toEqual([])
    })
  })

  describe('tripMemberGuard', () => {
    it('opens a trip the device already holds without asking the server', async () => {
      await db.trips.put({
        id: 'trip-1',
        name: 'Sample',
        startDate: '2027-01-20',
        endDate: '2027-02-06',
        baseCurrency: 'EUR',
        updatedAt: '2026-11-07T00:00:00.000Z',
      })

      expect(await visit('/t/trip-1/today')).toBe('/t/trip-1/today')
      expect(fakes.trips.calls).toEqual([])
    })

    it('fetches an unknown trip from the server, lets a member in and caches it', async () => {
      fakes.trips.trips = [
        { ...fakeTrip({ id: 'trip-2', name: 'Fetched' }), role: 'owner', memberCount: 1 },
      ]

      expect(await visit('/t/trip-2/today')).toBe('/t/trip-2/today')
      expect(fakes.trips.calls).toContain('snapshot:trip-2')
      expect((await db.trips.get('trip-2'))?.name).toBe('Fetched')
    })

    it('a foreign trip is not found: the not-found page, never a forbidden screen', async () => {
      fakes.trips.trips = [{ ...fakeTrip({ id: 'trip-2' }), role: 'owner', memberCount: 1 }]

      expect(await visit('/t/someone-elses/today')).toBe('/not-found')
    })

    it('offline with no copy it lets the page explain instead of redirecting', async () => {
      await TestBed.inject(MetaStore).set(META_SESSION, { ...FAKE_SESSION_USER, id: 'u1' })
      goOffline()

      expect(await visit('/t/unknown/today')).toBe('/t/unknown/today')
    })

    it('401 online clears the session and goes to sign in with the return url', async () => {
      await TestBed.inject(MetaStore).set(META_SESSION, { ...FAKE_SESSION_USER, id: 'u1' })
      fakes.trips.failWith = new ApiFailure({
        kind: 'http',
        status: 401,
        code: 'E_UNAUTHORIZED',
        message: 'Sign in first',
      })

      expect(await visit('/t/trip-9/today')).toBe('/login?returnUrl=%2Ft%2Ftrip-9%2Ftoday')
      expect(await TestBed.inject(MetaStore).get(META_SESSION)).toBeUndefined()
    })
  })

  describe('currentTripGuard', () => {
    it('resolves the active trip and keeps the rest of the path', async () => {
      await TestBed.inject(MetaStore).set(META_ACTIVE_TRIP, 'trip-9')

      expect(await visit('/t/current/add')).toBe('/t/trip-9/add')
    })

    it('with no active trip it goes to the list', async () => {
      expect(await visit('/t/current/add')).toBe('/trips')
    })
  })
})
