import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { RouterTestingHarness } from '@angular/router/testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from '../offline/db'
import { META_ACTIVE_TRIP, META_SESSION, MetaStore } from '../offline/meta.store'
import { OnlineStore } from '../offline/online.store'
import { authGuard } from './auth.guard'
import { currentTripGuard } from './current-trip.guard'
import { FakeSessionApi, SESSION_API } from './session-api'
import { tripMemberGuard } from './trip-member.guard'

@Component({ template: '<p data-testid="probe.page">page</p>' })
class Page {}

describe('route guards', () => {
  let db: MonkiTripsDb
  let api: FakeSessionApi

  beforeEach(() => {
    db = freshOfflineDb()
    api = new FakeSessionApi()
    TestBed.configureTestingModule({
      providers: [
        ...provideOfflineTesting({ db }),
        { provide: SESSION_API, useValue: api },
        provideRouter([
          { path: 'login', component: Page },
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

    it('sends an anonymous online visitor to /login with the target', async () => {
      api.user = null

      expect(await visit('/trips')).toBe('/login?next=%2Ftrips')
    })

    it('never redirects to /login while offline, even with no cached session', async () => {
      goOffline()

      expect(await visit('/trips')).toBe('/trips')
      expect(api.calls).toEqual([])
    })

    it('uses the cached session offline', async () => {
      await TestBed.inject(MetaStore).set(META_SESSION, { id: 'u1', displayName: 'Cached' })
      goOffline()

      expect(await visit('/trips')).toBe('/trips')
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
      expect(api.calls.filter((call) => call.startsWith('canOpenTrip'))).toEqual([])
    })

    it('asks the server about an unknown trip and lets a member in', async () => {
      api.openTrips = new Set(['trip-2'])

      expect(await visit('/t/trip-2/today')).toBe('/t/trip-2/today')
      expect(api.calls).toContain('canOpenTrip:trip-2')
    })

    it('a foreign trip is not found: back to the list, never a forbidden screen', async () => {
      api.openTrips = new Set(['trip-2'])

      expect(await visit('/t/someone-elses/today')).toBe('/trips')
    })

    it('offline with no copy it lets the page explain instead of redirecting', async () => {
      await TestBed.inject(MetaStore).set(META_SESSION, { id: 'u1', displayName: 'Cached' })
      goOffline()

      expect(await visit('/t/unknown/today')).toBe('/t/unknown/today')
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
