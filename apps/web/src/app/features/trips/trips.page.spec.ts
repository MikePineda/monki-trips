import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { TranslocoService } from '@jsverse/transloco'
import { i18nTesting } from '../../../testing/i18n-testing'
import { SCOPE_CATALOGUES } from '../../../testing/i18n-scopes'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from '../../core/offline/db'
import TripsPage from './trips.page'

describe('TripsPage', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [TripsPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), provideRouter([])],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  function render() {
    const fixture = TestBed.createComponent(TripsPage)
    fixture.detectChanges()
    return fixture
  }

  it('shows an honest empty state while the device holds no trips', () => {
    const fixture = render()
    const empty = fixture.nativeElement.querySelector('[data-testid="trips.empty"]')

    expect(empty.textContent).toContain(SCOPE_CATALOGUES.shell.en.trips.emptyTitle)
    expect(empty.querySelector('button')).toBeNull()
  })

  it('renders the empty state in spanish', () => {
    const fixture = render()
    TestBed.inject(TranslocoService).setActiveLang('es')
    fixture.detectChanges()

    expect(fixture.nativeElement.textContent).toContain(SCOPE_CATALOGUES.shell.es.trips.emptyTitle)
  })

  it('lists the trips on the device with a link into each one', async () => {
    await db.trips.put({
      id: 'trip-1',
      name: 'Sample trip',
      startDate: '2027-01-20',
      endDate: '2027-02-06',
      baseCurrency: 'EUR',
      updatedAt: '2026-11-07T00:00:00.000Z',
    })
    const fixture = render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(fixture.nativeElement.querySelector('[data-testid="trips.list"]')).not.toBeNull()
    })
    const link = fixture.nativeElement.querySelector(
      '[data-testid="trips.item"]'
    ) as HTMLAnchorElement

    expect(link.getAttribute('href')).toBe('/t/trip-1/today')
    expect(link.textContent).toContain('Sample trip')
    expect(link.textContent).toContain('2027-01-20 to 2027-02-06')
    expect(fixture.nativeElement.querySelector('[data-testid="trips.empty"]')).toBeNull()
  })
})
