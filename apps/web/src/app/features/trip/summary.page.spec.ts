import 'fake-indexeddb/auto'
import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting } from '../../../testing/api-testing'
import {
  DEMO_TRIP_ID,
  DEMO_TRIP_RECORD,
  blankStop,
  placedEvent,
} from '../../../testing/fake-trip-content'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import SummaryPage from './summary.page'

describe('SummaryPage', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [SummaryPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(apiFakes()),
        provideRouter([]),
      ],
    })
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(SummaryPage)
    fixture.componentRef.setInput('tripId', DEMO_TRIP_ID)
    fixture.detectChanges()
    await settle(fixture)
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  it('shows the dates, the counts, the route chips and the uncovered nights', async () => {
    await db.trips.put(DEMO_TRIP_RECORD)
    await db.stops.bulkPut([
      blankStop({ id: 's1', position: 0, name: 'Port Vellmar', countryCode: 'XA' }),
      blankStop({ id: 's2', position: 1, name: 'Aldermoor', countryCode: 'XB' }),
      blankStop({ id: 's3', position: 2, name: 'Aldermoor', countryCode: 'XB' }),
    ])
    await db.events.put(
      placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
        id: 'inn',
        kind: 'lodging',
        title: 'Harbour Inn',
        endsLocal: '2027-01-22T11:00',
      })
    )
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="trip.summary.route"]')).not.toBeNull()
    })
    expect(host.querySelector('[data-testid="trip.summary.dates"]')?.textContent).toContain(
      'Tue 20 Jan'
    )
    expect(host.querySelector('[data-testid="trip.summary.stats"]')?.textContent).toMatch(
      /5 days\s*·\s*4 nights\s*·\s*2 countries/
    )
    expect(host.querySelector('[data-testid="trip.summary.phase"]')?.textContent).toContain(
      'Starts in 74 days'
    )
    expect(host.querySelector('[data-testid="trip.summary.route"]')?.textContent).toMatch(
      /Port Vellmar\s*→\s*Aldermoor/
    )
    expect(host.querySelectorAll('[data-testid="trip.summary.stop"]')).toHaveLength(3)
    expect(host.querySelector('[data-testid="trip.summary.uncovered"]')?.textContent).toContain(
      '2 nights without a place to sleep'
    )
  })

  it('without stops it offers to add the first one', async () => {
    await db.trips.put(DEMO_TRIP_RECORD)
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="trip.summary.noStops"]')).not.toBeNull()
    })
    ;(host.querySelector('[data-testid="trip.summary.addStop"]') as HTMLButtonElement).click()
    await settle(fixture)

    expect(document.querySelector('[data-testid="trip.stop.name"]')).not.toBeNull()
  })
})
