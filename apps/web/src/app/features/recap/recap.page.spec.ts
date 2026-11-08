import 'fake-indexeddb/auto'
import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { DEMO_TRIP_RECORD, blankStop } from '../../../testing/fake-trip-content'
import { FakeRecapImage } from '../../../testing/fake-recap-image'
import { i18nTesting } from '../../../testing/i18n-testing'
import { defaultCategoryRecords, expenseRecord } from '../../../testing/money-fixtures'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { MAPLIBRE_LOADER, MAP_STYLE_FETCHER } from '../../shared/ui/map/map.component'
import { RECAP_IMAGE } from './recap-image'
import RecapPage from './recap.page'

/** Trip 2027-01-20 → 01-24, base AUD, A$1,000 budget. Invented places only. */
const TRIP = { ...DEMO_TRIP_RECORD, budgetTotalMinor: 100_000 }

const STOPS = [
  blankStop({
    id: 'a',
    position: 0,
    name: 'Port Vellmar',
    countryCode: 'XA',
    lat: 13.75,
    lng: 100.5,
    arriveOn: '2027-01-20',
    departOn: '2027-01-22',
  }),
  blankStop({
    id: 'b',
    position: 1,
    name: 'Kessa Bay',
    countryCode: 'XB',
    lat: 18.79,
    lng: 98.98,
    arriveOn: '2027-01-22',
    departOn: '2027-01-24',
  }),
]

const EXPENSES = [
  expenseRecord({
    id: 'hotel',
    categoryId: 'cat-accommodation',
    amountMinor: 30_000,
    baseAmountMinor: 30_000,
    spentOn: '2027-01-20',
    description: 'Guesthouse',
  }),
  expenseRecord({
    id: 'noodles',
    categoryId: 'cat-food',
    amountMinor: 1_500,
    baseAmountMinor: 1_500,
    spentOn: '2027-01-21',
  }),
  expenseRecord({
    id: 'payback',
    kind: 'settlement',
    categoryId: 'cat-other',
    amountMinor: 9_999,
    baseAmountMinor: 9_999,
    spentOn: '2027-01-22',
  }),
]

describe('RecapPage', () => {
  let db: MonkiTripsDb
  let image: FakeRecapImage
  let clock: TestClock

  beforeEach(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    image = new FakeRecapImage()
    clock = new TestClock('2027-02-10T03:00:00.000Z')
    TestBed.configureTestingModule({
      imports: [RecapPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, clock }),
        provideRouter([]),
        { provide: TIME_ZONE, useValue: 'UTC' },
        { provide: RECAP_IMAGE, useValue: image },
        { provide: MAPLIBRE_LOADER, useValue: () => Promise.reject(new Error('offline')) },
        { provide: MAP_STYLE_FETCHER, useValue: () => Promise.reject(new Error('offline')) },
      ],
    })
    await db.trips.put(TRIP)
    await db.stops.bulkPut(STOPS)
    await db.budgetCategories.bulkPut(defaultCategoryRecords())
    await db.expenses.bulkPut(EXPENSES)
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(RecapPage)
    fixture.componentRef.setInput('tripId', 'trip-1')
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const until = (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    const tile = (id: string) =>
      byId(`recap.stat.${id}`)?.querySelector('.mk-stat__value')?.textContent?.trim()
    return { fixture, host, byId, until, tile }
  }

  it('recap comes from the device copy offline', async () => {
    const { byId, until, tile, host } = await render()

    await until(() => expect(tile('days')).toBe('5'))
    expect(byId('recap.title')?.textContent).toContain('Trip recap')
    expect(byId('recap.mascot')?.getAttribute('aria-label')).toBe('Kiko celebrating')
    expect(tile('nights')).toBe('4')
    expect(tile('countries')).toBe('2')
    expect(tile('distance')).toMatch(/^\d[\d,]* km$/)
    // Settlements are not spending: A$300 + A$15 only.
    expect(tile('spent')).toBe('$315.00')
    expect(byId('recap.settlements')).not.toBeNull()
    // Two categories, the settlement left out of them too.
    expect(host.querySelectorAll('[data-testid="recap.money.chart.bar"]')).toHaveLength(2)
    expect(host.querySelectorAll('[data-testid="recap.stamp"]').length).toBeGreaterThan(0)
    // Offline: the CSV needs the server, so its link is not offered.
    expect(byId('recap.exportCsv')).toBeNull()
    expect(byId('recap.csvOffline')).not.toBeNull()
  })

  it('an unfinished trip is shown as so far', async () => {
    clock.now = '2027-01-22T03:00:00.000Z'
    const { byId, until, tile } = await render()

    await until(() => expect(tile('days')).toBe('5'))
    expect(byId('recap.title')?.textContent).toContain('The trip so far')
    expect(byId('recap.hero')?.getAttribute('data-phase')).toBe('ongoing')
    expect(byId('recap.phase')?.textContent).toContain('Day 3 of 5')
    expect(byId('recap.mascot')?.getAttribute('aria-label')).toBe('Kiko on the road')
  })

  it('the share image hides money by default', async () => {
    const { byId, until, tile, fixture } = await render()
    await until(() => expect(tile('spent')).toBe('$315.00'))

    byId('recap.saveImage')!.click()
    await settle(fixture)
    await until(() => expect(image.cards).toHaveLength(1))

    const [{ card, fileName }] = image.cards
    expect(card.includesMoney).toBe(false)
    expect(JSON.stringify(card)).not.toContain('$')
    expect(card.route).toBe('Port Vellmar → Kessa Bay')
    expect(fileName).toBe('harbour-and-hills-recap.png')

    byId('recap.includeMoney')!.click()
    await settle(fixture)
    byId('recap.saveImage')!.click()
    await settle(fixture)
    await until(() => expect(image.cards).toHaveLength(2))
    expect(image.cards[1]!.card.includesMoney).toBe(true)
    expect(JSON.stringify(image.cards[1]!.card)).toContain('$315.00')
  })

  it('an empty trip gets an honest empty state', async () => {
    await db.stops.clear()
    await db.expenses.clear()
    const { byId, until } = await render()

    await until(() => expect(byId('recap.empty')).not.toBeNull())
    expect(byId('recap.stats')).toBeNull()
  })

  it('offers the expenses CSV when online', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { byId, until } = await render()

    await until(() => expect(byId('recap.exportCsv')).not.toBeNull())
    expect(byId('recap.exportCsv')!.getAttribute('href')).toBe('/api/v1/trips/trip-1/expenses.csv')
    expect(byId('recap.exportCsv')!.hasAttribute('download')).toBe(true)
  })
})
