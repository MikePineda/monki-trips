import 'fake-indexeddb/auto'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { TranslocoService } from '@jsverse/transloco'
import { apiFakes, provideApiTesting } from '../../../testing/api-testing'
import {
  DEMO_TRIP_ID,
  DEMO_TRIP_RECORD,
  blankDocument,
  blankStop,
  placedEvent,
} from '../../../testing/fake-trip-content'
import { FakeWeatherProvider } from '../../../testing/fake-weather-provider'
import { tripWeatherFixture } from '../../../testing/weather-fixtures'
import { expenseRecord } from '../../../testing/money-fixtures'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { toDocumentRecord } from '../../core/offline/document-record'
import { toEventRecord } from '../../core/offline/event-record'
import { outboxMutation } from '../../core/offline/mutation'
import type { TaskRecord } from '../../core/offline/records'
import { toStopRecord } from '../../core/offline/stop-record'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { WEATHER_PROVIDER, weatherKey } from '../../core/offline/weather'
import TodayPage from './today.page'

/** 12:00 in Port Vellmar (UTC+7) on day 2 of the demo trip. */
const NOON_DAY_2 = '2027-01-21T05:00:00.000Z'

const PRINT_TASK: TaskRecord = {
  id: 'print-task',
  tripId: DEMO_TRIP_ID,
  eventId: null,
  title: 'Museum voucher',
  titleKey: 'print_document',
  notes: null,
  dueOn: '2027-01-19',
  priority: 'normal',
  doneAt: null,
  doneBy: null,
  origin: 'document',
  sourceDocumentId: 'voucher',
  templateItemKey: null,
  updatedAt: '2026-11-07T00:00:00.000Z',
}

describe('TodayPage', () => {
  let db: MonkiTripsDb
  let clock: TestClock
  let weather: FakeWeatherProvider

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    clock = new TestClock(NOON_DAY_2)
    weather = new FakeWeatherProvider()
    TestBed.configureTestingModule({
      imports: [TodayPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, clock }),
        ...provideApiTesting(apiFakes()),
        provideRouter([]),
        { provide: TIME_ZONE, useValue: 'Australia/Sydney' },
        { provide: WEATHER_PROVIDER, useValue: weather },
      ],
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function seedDay() {
    await db.trips.put({ ...DEMO_TRIP_RECORD, budgetTotalMinor: 100_000 })
    await db.stops.put(toStopRecord(blankStop()))
    await db.events.bulkPut([
      toEventRecord(
        placedEvent('2027-01-21T15:00', 'Asia/Bangkok', {
          id: 'museum',
          kind: 'tour',
          title: 'Museum of the Tides',
          bookingCode: 'MUS-0042',
          address: '3 Tide Street',
        })
      ),
      toEventRecord(
        placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
          id: 'inn',
          kind: 'lodging',
          title: 'Harbour Inn',
          address: '14 Quay Lane',
          addressLocal: 'Οδός Προκυμαίας 14',
          endsLocal: '2027-01-23T11:00',
        })
      ),
    ])
    await db.docs.bulkPut([
      toDocumentRecord(
        blankDocument({
          id: 'voucher',
          eventId: 'museum',
          title: 'Museum voucher',
          tags: ['print'],
        })
      ),
      toDocumentRecord(
        blankDocument({
          id: 'pass',
          eventId: 'museum',
          title: 'Entry pass',
          tags: ['show_on_phone'],
        })
      ),
    ])
    await db.tasks.put(PRINT_TASK)
  }

  async function render() {
    const fixture = TestBed.createComponent(TodayPage)
    fixture.componentRef.setInput('tripId', DEMO_TRIP_ID)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const text = (testId: string) =>
      host.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ??
      ''
    const until = async (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    return { fixture, host, text, until }
  }

  it('renders the day, the next event, the documents, tonight and what is left, with no network', async () => {
    await seedDay()
    await db.expenses.put({
      ...expenseRecord({ id: 'lunch', amountMinor: 2_000, baseAmountMinor: 2_000 }),
      syncState: 'pending',
    })
    const { host, text, until } = await render()

    await until(() => expect(text('today.day')).toBe('Day 2 of 5 · Port Vellmar'))
    expect(text('today.next')).toContain('Museum of the Tides')
    expect(text('ui.ticket.time')).toBe('15:00')
    // The place is four hours behind the Sydney device: the zone shows next to the time.
    expect(text('today.next')).toContain('GMT+7')
    expect(text('today.next')).toContain('in 3 h 00 min')
    expect(text('ui.ticket.leave')).toBe('Leave at 14:45')
    expect(text('ui.ticket.reference')).toBe('MUS-0042')
    expect(host.querySelector('[data-testid="today.next.directions"]')?.getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=3%20Tide%20Street'
    )
    expect(text('today.print')).toContain('Bring this printed')
    expect(text('today.print')).toContain('Museum voucher')
    const docs = [...host.querySelectorAll('[data-testid="today.document"]')].map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim()
    )
    expect(docs).toEqual([
      expect.stringContaining('Museum voucher'),
      expect.stringContaining('Entry pass'),
    ])
    expect(docs[1]).toContain('Not on this phone')
    expect(text('today.tonight.name')).toBe('Harbour Inn')
    expect(text('today.tonight.address')).toBe('14 Quay Lane')
    expect(text('today.tonight.addressLocal')).toBe('Οδός Προκυμαίας 14')
    expect(text('today.tonight.checkIn')).toBe('Check-in 15:00')
    // (100 000 − 0) over the 4 days left = 25 000, minus today's queued 2 000.
    expect(text('today.money.hero')).toBe('$230.00')
    expect(text('today.money.pending')).toBe('Includes 1 expense waiting to sync')
    expect(host.querySelector('[data-testid="today.weather"]')).toBeNull()
    expect(host.querySelector('[data-testid="today.mascot"]')?.getAttribute('data-state')).toBe(
      'worried'
    )
  })

  it('one quiet link opens Kiko', async () => {
    await seedDay()
    const { host, text, until } = await render()

    await until(() => expect(text('today.assistant')).toBe('Ask Kiko about the trip'))
    const links = host.querySelectorAll('[data-testid="today.assistant"]')
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toBe(`/t/${DEMO_TRIP_ID}/more/assistant`)
    expect(host.querySelector('mk-mascot[data-state="thinking"]')).toBeNull()
  })

  it('tonight’s address card is one tap away: "Show to driver" opens it full screen', async () => {
    await seedDay()
    const { host, until } = await render()
    await until(() =>
      expect(host.querySelector('[data-testid="today.tonight.name"]')).not.toBeNull()
    )
    expect(host.querySelector('[data-testid="today.tonight.showDriver"]')).toBeNull()

    await db.phraseCards.put({
      id: 'set-el',
      tripId: DEMO_TRIP_ID,
      language: 'el',
      cards: [
        {
          category: 'greetings',
          prompt: 'Hello',
          phrase: 'Γεια σας',
          romanization: null,
          note: null,
        },
        {
          category: 'lodging_address',
          prompt: 'Please take me to this address',
          phrase: 'Παρακαλώ, Οδός Προκυμαίας 14',
          romanization: null,
          note: null,
        },
      ],
      updatedAt: '2026-11-07T00:00:00.000Z',
    })

    await until(() =>
      expect(
        host.querySelector('[data-testid="today.tonight.showDriver"]')?.getAttribute('href')
      ).toMatch(/\/more\/phrases\/show\/set-el(:|%3A)1$/)
    )
    expect(host.querySelector('[data-testid="today.tonight.showDriver"]')?.textContent).toContain(
      'Show to driver'
    )
  })

  it('print band marks the task done through the outbox', async () => {
    await seedDay()
    const { host, until } = await render()
    await until(() => expect(host.querySelector('[data-testid="today.print.done"]')).not.toBeNull())

    ;(host.querySelector('[data-testid="today.print.done"]') as HTMLButtonElement).click()

    await until(() => expect(host.querySelector('[data-testid="today.print"]')).toBeNull())
    expect(await db.tasks.get('print-task')).toMatchObject({
      doneAt: NOON_DAY_2,
      syncState: 'pending',
    })
    const queued = (await db.outbox.toArray()).map(outboxMutation)
    expect(queued).toEqual([
      expect.objectContaining({
        entity: 'task',
        op: 'upsert',
        id: 'print-task',
        changes: { doneAt: NOON_DAY_2 },
      }),
    ])
  })

  it('says over budget in words, and shows the local currency with the base below', async () => {
    await seedDay()
    // Today's stop is in a euro country: the hero follows it, at the dinner's rate.
    await db.stops.put(toStopRecord(blankStop({ countryCode: 'GR' })))
    await db.expenses.put(
      expenseRecord({
        id: 'dinner',
        amountMinor: 18_000,
        currency: 'EUR',
        fxRate: '0.6',
        baseAmountMinor: 30_000,
      })
    )
    const { text, until } = await render()

    // 25 000 allowed today minus 30 000 spent: A$50 over, €30 at the trip's rate.
    await until(() => expect(text('today.money.hero')).toBe('−€30.00'))
    expect(text('today.money.base')).toBe('−A$50.00')
    expect(text('today.money.over')).toBe("Over today's budget by €30.00")
  })

  it('an uncovered night raises the alert and an empty day says so', async () => {
    await db.trips.put(DEMO_TRIP_RECORD)
    await db.stops.put(toStopRecord(blankStop()))
    const { host, text, until } = await render()

    await until(() => expect(text('today.tonight.alert')).toContain('Nowhere to sleep tonight'))
    expect(text('today.next.empty')).toContain('Nothing else planned')
    expect(
      host.querySelector('[data-testid="today.next.empty"] mk-mascot')?.getAttribute('data-size')
    ).toBe('sm')
    expect(text('today.money.empty')).toContain('No budget yet')
    expect(host.querySelector('[data-testid="today.documents"]')).toBeNull()
  })

  it('shows the cached weather of the day with its age, max/min, rain and attribution, offline', async () => {
    await seedDay()
    await db.meta.put({
      key: weatherKey(DEMO_TRIP_ID, '2027-01-21'),
      value: { ...tripWeatherFixture(), updatedAt: '2027-01-21T02:00:00.000Z' },
    })
    const { host, text, until } = await render()

    await until(() => expect(text('today.weather.summary')).toBe('18° · Rain'))
    expect(text('today.weather.range')).toBe('21° / 13° · 80% rain')
    expect(text('today.weather.age')).toMatch(/^Updated 3 hrs? ago$/)
    expect(text('today.weather.attribution')).toBe('Weather data by Open-Meteo.com')
    expect(host.querySelector('[data-testid="today.weather"] use')?.getAttribute('href')).toBe(
      'sprite/lucide.svg#cloud-rain'
    )
    expect(weather.asked).toEqual([])
  })

  it('a later day without a current reading shows the sky of the day', async () => {
    await seedDay()
    await db.meta.put({
      key: weatherKey(DEMO_TRIP_ID, '2027-01-21'),
      value: {
        ...tripWeatherFixture({ current: null }),
        updatedAt: '2027-01-21T02:00:00.000Z',
      },
    })
    const { text, until } = await render()

    await until(() => expect(text('today.weather.summary')).toBe('Rain'))
  })

  it('hides the row when nothing is cached for the day shown', async () => {
    await seedDay()
    await db.meta.put({
      key: weatherKey(DEMO_TRIP_ID, '2027-01-20'),
      value: {
        ...tripWeatherFixture({ date: '2027-01-20' }),
        updatedAt: '2027-01-20T02:00:00.000Z',
      },
    })
    const { host, text, until } = await render()

    await until(() => expect(text('today.day')).toBe('Day 2 of 5 · Port Vellmar'))
    expect(host.querySelector('[data-testid="today.weather"]')).toBeNull()
  })

  it('online it asks the day once and shows what it cached', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    await seedDay()
    const { text, until } = await render()

    await until(() => expect(text('today.weather.summary')).toBe('18° · Rain'))
    expect(weather.asked).toEqual([{ tripId: DEMO_TRIP_ID, date: '2027-01-21' }])
    expect(await db.meta.get(weatherKey(DEMO_TRIP_ID, '2027-01-21'))).toBeDefined()
  })

  it('before the trip it previews day 1', async () => {
    clock.now = '2027-01-10T05:00:00.000Z'
    await seedDay()
    const { text, until } = await render()

    await until(() => expect(text('today.day')).toBe('Day 1 of 5 · Port Vellmar'))
    expect(text('today.preview')).toBe('Preview of day 1 · the trip starts on Wed 20 Jan')
    expect(text('today.tonight.name')).toBe('Harbour Inn')
  })

  it('waits with the thinking mascot until the trip is on the device', async () => {
    const { host } = await render()

    expect(
      host.querySelector('[data-testid="today.loading"] mk-mascot')?.getAttribute('data-state')
    ).toBe('thinking')
  })

  it('follows a language switch', async () => {
    await seedDay()
    const { fixture, text, until } = await render()
    await until(() => expect(text('today.day')).toBe('Day 2 of 5 · Port Vellmar'))

    TestBed.inject(TranslocoService).setActiveLang('es')
    fixture.detectChanges()

    await until(() => expect(text('today.day')).toBe('Día 2 de 5 · Port Vellmar'))
    expect(text('today.print')).toContain('Llévalo impreso')
  })
})
