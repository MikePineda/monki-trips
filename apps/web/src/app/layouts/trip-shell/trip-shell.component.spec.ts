import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { TranslocoService } from '@jsverse/transloco'
import { i18nTesting } from '../../../testing/i18n-testing'
import { providePwaTesting } from '../../../testing/pwa-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from '../../core/offline/db'
import { META_ACTIVE_TRIP, MetaStore } from '../../core/offline/meta.store'
import { TripShellComponent } from './trip-shell.component'

describe('TripShellComponent', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [TripShellComponent, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), providePwaTesting(), provideRouter([])],
    })
  })

  afterEach(async () => {
    await resetOfflineTesting(db)
  })

  async function render(tripId = 'trip-1') {
    const fixture = TestBed.createComponent(TripShellComponent)
    fixture.componentRef.setInput('tripId', tripId)
    fixture.detectChanges()
    await fixture.whenStable()
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  it('shows the five tabs linking into the trip, in order', async () => {
    const { host } = await render()
    const links = [...host.querySelectorAll('mk-tab-bar a')]

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Today',
      'Plan',
      'Docs',
      'Money',
      'More',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/t/trip-1/today',
      '/t/trip-1/plan',
      '/t/trip-1/docs',
      '/t/trip-1/money',
      '/t/trip-1/more',
    ])
  })

  it('tab labels follow a language switch', async () => {
    const { fixture, host } = await render()

    TestBed.inject(TranslocoService).setActiveLang('es')
    fixture.detectChanges()

    expect(host.querySelector('[data-testid="shell.tab.today"]')?.textContent?.trim()).toBe('Hoy')
  })

  it('titles the header with the trip name from the device and remembers the active trip', async () => {
    await db.trips.put({
      id: 'trip-1',
      name: 'Sample trip',
      startDate: '2027-01-20',
      endDate: '2027-02-06',
      baseCurrency: 'EUR',
      updatedAt: '2026-11-07T00:00:00.000Z',
    })
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="shell.name"]')?.textContent?.trim()).toBe(
        'Sample trip'
      )
    })
    expect(await TestBed.inject(MetaStore).get(META_ACTIVE_TRIP)).toBe('trip-1')
    expect(host.querySelector('[data-testid="shell.back"]')?.getAttribute('href')).toBe('/trips')
  })

  it('falls back to a generic title for a trip the device does not hold', async () => {
    const { host } = await render('unknown')

    expect(host.querySelector('[data-testid="shell.name"]')?.textContent?.trim()).toBe('Trip')
  })
})
