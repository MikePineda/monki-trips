import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { blankStop } from '../../../testing/fake-trip-content'
import { SCOPE_CATALOGUES } from '../../../testing/i18n-scopes'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from '../../core/offline/db'
import { OnlineStore } from '../../core/offline/online.store'
import { MAPLIBRE_LOADER, MAP_STYLE_FETCHER } from '../../shared/ui/map/map.component'
import PassportMapPage from './passport-map.page'

const PAST = {
  id: 'past',
  name: 'Island hop',
  startDate: '2026-05-01',
  endDate: '2026-05-10',
  baseCurrency: 'EUR',
  updatedAt: '2026-11-07T00:00:00.000Z',
}

describe('PassportMapPage', () => {
  let db: MonkiTripsDb
  const loader = vi.fn()
  const fetchStyle = vi.fn(async () => {
    throw new TypeError('Failed to fetch')
  })

  beforeEach(() => {
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [PassportMapPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        provideRouter([]),
        { provide: MAPLIBRE_LOADER, useValue: loader },
        { provide: MAP_STYLE_FETCHER, useValue: fetchStyle },
      ],
    })
  })

  afterEach(async () => {
    loader.mockClear()
    fetchStyle.mockClear()
    await resetOfflineTesting(db)
  })

  it('map falls back to the svg view offline, with the visited cities as dots and a calm banner', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    await db.trips.put(PAST)
    await db.stops.bulkPut([
      blankStop({
        id: 'a',
        tripId: 'past',
        position: 0,
        name: 'Harbour City',
        countryCode: 'XA',
        lat: 12.5,
        lng: 10,
        arriveOn: '2026-05-01',
        departOn: '2026-05-05',
      }),
      blankStop({
        id: 'b',
        tripId: 'past',
        position: 1,
        name: 'Old Town',
        countryCode: 'XB',
        lat: 14,
        lng: 16,
        arriveOn: '2026-05-05',
        departOn: '2026-05-10',
      }),
      blankStop({
        id: 'c',
        tripId: 'past',
        position: 2,
        name: 'No coordinates',
        countryCode: 'XB',
        arriveOn: '2026-05-10',
        departOn: '2026-05-10',
      }),
    ])
    const fixture = TestBed.createComponent(PassportMapPage)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelectorAll('[data-testid="mk-world-map.place"]')).toHaveLength(2)
    })
    expect(host.querySelector('[data-testid="passport.map"]')?.getAttribute('data-mode')).toBe(
      'fallback'
    )
    expect(host.querySelectorAll('[data-testid="mk-world-map.route"]')).toHaveLength(1)
    expect(host.querySelector('[data-testid="passport.map.offline"]')?.textContent).toContain(
      SCOPE_CATALOGUES.passport.en.map.offline
    )
    expect(host.querySelector('mk-world-map')?.getAttribute('aria-label')).toContain(
      'Harbour City, Old Town'
    )
    expect(host.querySelectorAll('[data-testid="mk-map-legend.item"]')).toHaveLength(1)
    expect(fetchStyle).not.toHaveBeenCalled()
    expect(loader).not.toHaveBeenCalled()
  })

  it('online but the tiles do not answer: still the svg view, and no banner', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(true)
    const fixture = TestBed.createComponent(PassportMapPage)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement

    await vi.waitFor(() => expect(fetchStyle).toHaveBeenCalled())
    fixture.detectChanges()
    await vi.waitFor(() =>
      expect(host.querySelector('[data-testid="passport.map"]')?.getAttribute('data-mode')).toBe(
        'fallback'
      )
    )
    expect(host.querySelector('[data-testid="passport.map.offline"]')).toBeNull()
    expect(host.querySelector('[data-testid="passport.map.noPlaces"]')).not.toBeNull()
    expect(loader).not.toHaveBeenCalled()
  })
})
