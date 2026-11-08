import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { TranslocoService } from '@jsverse/transloco'
import { apiFakes, provideApiTesting, type ApiFakes } from '../../../testing/api-testing'
import { SCOPE_CATALOGUES } from '../../../testing/i18n-scopes'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import { ApiFailure } from '../../core/api/api-failure'
import { fakeTrip } from '../../../testing/fake-trips-api'
import type { MonkiTripsDb } from '../../core/offline/db'
import { OnlineStore } from '../../core/offline/online.store'
import { FAKE_SESSION_USER } from '../../../testing/fake-session-api'
import { SessionStore } from '../../core/session/session.store'
import { blankStop } from '../../../testing/fake-trip-content'
import { expenseRecord } from '../../../testing/money-fixtures'
import { MetaStore } from '../../core/offline/meta.store'
import { FakeSyncApi } from '../../../testing/fake-sync-api'
import TripsPage from './trips.page'

/** TEST_NOW is 2026-11-07: one trip on the road, one coming up, one we are back from. */
const ONGOING = {
  ...DEVICE_TRIP_FIELDS(),
  id: 'on',
  name: 'Long loop',
  startDate: '2026-11-01',
  endDate: '2026-11-20',
}
const UPCOMING = {
  ...DEVICE_TRIP_FIELDS(),
  id: 'up',
  name: 'Snow week',
  startDate: '2027-02-01',
  endDate: '2027-02-07',
}
const PAST = {
  ...DEVICE_TRIP_FIELDS(),
  id: 'past',
  name: 'Island hop',
  startDate: '2026-05-01',
  endDate: '2026-05-10',
}
/** Back four days ago: Kiko still celebrates. */
const JUST_BACK = {
  ...DEVICE_TRIP_FIELDS(),
  id: 'back',
  name: 'Coast run',
  startDate: '2026-10-25',
  endDate: '2026-11-03',
}

function DEVICE_TRIP_FIELDS() {
  return { baseCurrency: 'EUR', updatedAt: '2026-11-07T00:00:00.000Z' }
}

const DEVICE_TRIP = {
  id: 'trip-1',
  name: 'Sample trip',
  startDate: '2027-01-20',
  endDate: '2027-02-06',
  baseCurrency: 'EUR',
  updatedAt: '2026-11-07T00:00:00.000Z',
}

describe('TripsPage', () => {
  let db: MonkiTripsDb
  let fakes: ApiFakes
  let syncApi: FakeSyncApi

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    syncApi = new FakeSyncApi()
    TestBed.configureTestingModule({
      imports: [TripsPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, api: syncApi }),
        ...provideApiTesting(fakes),
        provideRouter([]),
      ],
    })
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    await resetOfflineTesting(db)
  })

  async function render() {
    await TestBed.inject(SessionStore).restore()
    const fixture = TestBed.createComponent(TripsPage)
    fixture.detectChanges()
    await settle(fixture)
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  it('shows an honest empty state with the one action: create the first trip', async () => {
    const { host } = await render()
    const empty = host.querySelector('[data-testid="trips.empty"]')!

    expect(empty.textContent).toContain(SCOPE_CATALOGUES.shell.en.trips.emptyTitle)
    expect(empty.querySelector('[data-testid="trips.create"]')?.textContent?.trim()).toBe(
      SCOPE_CATALOGUES.shell.en.trips.create.first
    )
  })

  it('renders the empty state in spanish', async () => {
    const { fixture, host } = await render()
    TestBed.inject(TranslocoService).setActiveLang('es')
    fixture.detectChanges()

    expect(host.textContent).toContain(SCOPE_CATALOGUES.shell.es.trips.emptyTitle)
  })

  it('lists the trips on the device with a link into each one', async () => {
    await db.trips.put(DEVICE_TRIP)
    fakes.trips.trips = [{ ...fakeTrip({ id: 'trip-1' }), role: 'owner', memberCount: 1 }]
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="trips.list"]')).not.toBeNull()
    })
    const link = host.querySelector('[data-testid="trips.item"]') as HTMLAnchorElement

    expect(link.getAttribute('href')).toBe('/t/trip-1/today')
    expect(link.textContent).toContain('Sample trip')
    expect(link.textContent).toContain('20 Jan – 6 Feb 2027')
    expect(link.textContent).not.toContain('2027-01-20')
    expect(host.querySelector('[data-testid="trips.empty"]')).toBeNull()
  })

  it('refreshes the device copy from the server: new trips appear, gone ones leave', async () => {
    await db.trips.put({ ...DEVICE_TRIP, id: 'gone', name: 'Deleted elsewhere' })
    fakes.trips.trips = [
      { ...fakeTrip({ id: 'trip-2', name: 'From server' }), role: 'owner', memberCount: 1 },
    ]
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.textContent).toContain('From server')
    })
    expect(host.textContent).not.toContain('Deleted elsewhere')
    expect(await db.trips.get('gone')).toBeUndefined()
    expect(fakes.trips.calls).toEqual(['list'])
  })

  it('after the list arrives it pulls the content of every trip, for the history and the passport', async () => {
    fakes.trips.trips = [{ ...fakeTrip({ id: 'trip-1' }), role: 'owner', memberCount: 1 }]
    await render()

    await vi.waitFor(() => expect(syncApi.calls.some((call) => call.kind === 'pull')).toBe(true))
  })

  it('offline it shows the device copy and never asks the server', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    await db.trips.put(DEVICE_TRIP)
    const { host } = await render()

    await vi.waitFor(() => expect(host.textContent).toContain('Sample trip'))
    expect(fakes.trips.calls).toEqual([])
  })

  it('a failed refresh keeps the saved data and says why', async () => {
    await db.trips.put(DEVICE_TRIP)
    fakes.trips.failWith = new ApiFailure({ kind: 'network', message: 'offline' })
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="trips.error"]')?.textContent?.trim()).toBe(
        SCOPE_CATALOGUES.shell.en.errors.network
      )
    })
    expect(host.textContent).toContain('Sample trip')
  })

  it('an unverified address shows the way to verify instead of the create button', async () => {
    fakes.session.user = { ...FAKE_SESSION_USER, emailVerifiedAt: null }
    fakes.trips.failWith = new ApiFailure({
      kind: 'http',
      status: 403,
      code: 'E_EMAIL_NOT_VERIFIED',
      message: 'verify',
    })
    const { host } = await render()

    expect(host.querySelector('[data-testid="trips.unverified"]')).not.toBeNull()
    expect(host.querySelector('[data-testid="trips.verify"]')?.getAttribute('href')).toBe(
      '/verify-email'
    )
    expect(host.querySelector('[data-testid="trips.create"]')).toBeNull()
  })

  it('history groups trips by phase: on the road, coming up, then where we have been', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    await db.trips.bulkPut([PAST, UPCOMING, ONGOING])
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelectorAll('[data-testid="trips.item"]')).toHaveLength(3)
    })
    const sections = [...host.querySelectorAll('[data-testid^="history."]')]
      .map((section) => section.getAttribute('data-testid'))
      .filter((id) => ['history.ongoing', 'history.upcoming', 'history.past'].includes(id!))
    expect(sections).toEqual(['history.ongoing', 'history.upcoming', 'history.past'])
    const names = (phase: string) =>
      [...host.querySelectorAll(`[data-testid="history.${phase}"] [data-testid="trips.item"]`)].map(
        (item) => item.querySelector('.mk-trip-ticket__title')?.textContent?.trim()
      )
    expect(names('ongoing')).toEqual(['Long loop'])
    expect(names('upcoming')).toEqual(['Snow week'])
    expect(names('past')).toEqual(['Island hop'])
    expect(host.querySelector('[data-testid="history.ongoing"]')?.textContent).toContain(
      'Day 7 of 20'
    )
    expect(host.querySelector('[data-testid="history.upcoming"]')?.textContent).toContain(
      'In 86 days'
    )
    expect(host.querySelector('[data-testid="history.noPast"]')).toBeNull()
    const href = (phase: string) =>
      host
        .querySelector(`[data-testid="history.${phase}"] [data-testid="trips.item"]`)
        ?.getAttribute('href')
    // A trip we are back from opens its recap; the others open Today.
    expect(href('past')).toBe('/t/past/recap')
    expect(href('ongoing')).toBe('/t/on/today')
  })

  it('a past trip is a ticket with its route, days, nights, countries, total spent and cover stamp', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    await db.trips.put(PAST)
    await db.stops.bulkPut([
      blankStop({
        id: 's1',
        tripId: 'past',
        position: 0,
        name: 'Harbour City',
        countryCode: 'XC',
        arriveOn: '2026-05-01',
        departOn: '2026-05-05',
      }),
      blankStop({
        id: 's2',
        tripId: 'past',
        position: 1,
        name: 'Old Town',
        countryCode: 'XD',
        arriveOn: '2026-05-05',
        departOn: '2026-05-10',
      }),
    ])
    await db.expenses.bulkPut([
      expenseRecord({ id: 'x1', tripId: 'past', baseAmountMinor: 12_000 }),
      expenseRecord({ id: 'x2', tripId: 'past', baseAmountMinor: 3_050 }),
    ])
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="trips.item.stamp"]')).not.toBeNull()
    })
    const ticket = host.querySelector('[data-testid="trips.item"]')!
    const text = ticket.textContent!.replace(/\s+/g, ' ')
    expect(ticket.getAttribute('href')).toBe('/t/past/recap')
    expect(text).toContain('Harbour City → Old Town')
    expect(text).toContain('10 days · 9 nights · 2 countries')
    expect(text).toContain('1 – 10 May 2026')
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(ticket.querySelector('[data-testid="mk-trip-ticket.amount"]')?.textContent?.trim()).toBe(
      '€150.50'
    )
    const stamp = ticket.querySelector('[data-testid="trips.item.stamp"]')!
    expect(stamp.getAttribute('data-code')).toBe('XC')
    expect(stamp.getAttribute('aria-label')).toBe('Stamp of Harbour City')
    expect(stamp.hasAttribute('data-reached')).toBe(true)
  })

  it('without a past trip, Kiko says the stamps land here when a trip ends', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    await db.trips.put(UPCOMING)
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="history.noPast"]')).not.toBeNull()
    })
    expect(
      host.querySelector('[data-testid="history.noPast"] mk-mascot')?.getAttribute('data-state')
    ).toBe('asleep')
    expect(host.querySelector('[data-testid="history.noPast"]')?.textContent).toContain(
      SCOPE_CATALOGUES.history.en.empty.pastTitle
    )
  })

  it('a trip that ended this week has Kiko celebrating its new stamps, stamped in only the first time', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    await db.trips.bulkPut([JUST_BACK, PAST])
    await db.stops.bulkPut([
      blankStop({
        id: 's1',
        tripId: 'back',
        position: 0,
        name: 'Lantern Bay',
        countryCode: 'XC',
        arriveOn: '2026-10-25',
        departOn: '2026-10-30',
      }),
      blankStop({
        id: 's2',
        tripId: 'back',
        position: 1,
        name: 'Saltmarsh',
        countryCode: 'XC',
        arriveOn: '2026-10-30',
        departOn: '2026-11-03',
      }),
      blankStop({
        id: 's3',
        tripId: 'past',
        position: 0,
        name: 'Old Town',
        countryCode: 'XD',
        arriveOn: '2026-05-01',
        departOn: '2026-05-10',
      }),
    ])
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelectorAll('[data-testid="history.newStamp"]')).toHaveLength(3)
    })
    const party = host.querySelector('[data-testid="history.celebration"]')!
    expect(party.querySelector('mk-mascot')?.getAttribute('data-state')).toBe('celebrating')
    expect(party.textContent).toContain(SCOPE_CATALOGUES.history.en.celebration.title)
    expect(party.textContent).toContain('Coast run is in the passport')
    expect(
      [...party.querySelectorAll('[data-testid="history.newStamp"]')].map((stamp) =>
        stamp.getAttribute('aria-label')
      )
    ).toEqual(['XC', 'Lantern Bay', 'Saltmarsh'])
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(
        party.querySelector('[data-testid="history.newStamp"]')?.hasAttribute('data-animate')
      ).toBe(true)
    })
    expect(await TestBed.inject(MetaStore).get('history.stampsSeen.back')).toBe(true)
    expect(party.querySelector('[data-testid="history.openRecap"]')?.getAttribute('href')).toMatch(
      /^\/t\/[^/]+\/recap$/
    )
    expect(party.querySelector('[data-testid="history.openPassport"]')?.getAttribute('href')).toBe(
      '/passport'
    )
  })

  it('the new stamps do not stamp themselves in again on the next visit', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    await db.trips.put(JUST_BACK)
    await db.stops.put(
      blankStop({
        id: 's1',
        tripId: 'back',
        name: 'Lantern Bay',
        countryCode: 'XC',
        arriveOn: '2026-10-25',
        departOn: '2026-10-30',
      })
    )
    await TestBed.inject(MetaStore).set('history.stampsSeen.back', true)
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="history.newStamp"]')).not.toBeNull()
    })
    await settle(fixture)
    expect(
      host.querySelector('[data-testid="history.newStamp"]')?.hasAttribute('data-animate')
    ).toBe(false)
  })

  it('nothing to celebrate once the week after the trip is over', async () => {
    vi.spyOn(TestBed.inject(OnlineStore), 'online').mockReturnValue(false)
    await db.trips.put(PAST)
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="trips.item"]')).not.toBeNull()
    })
    expect(host.querySelector('[data-testid="history.celebration"]')).toBeNull()
  })

  it('opens the passport from the header', async () => {
    const { host } = await render()
    expect(host.querySelector('[data-testid="trips.passport"]')?.getAttribute('href')).toBe(
      '/passport'
    )
  })

  it('creates a trip from the sheet and opens it', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
    const { fixture, host } = await render()
    host.querySelector<HTMLElement>('[data-testid="trips.create"]')!.click()
    await settle(fixture)
    const sheet = document.querySelector('.cdk-overlay-container')!
    const field = (id: string) => sheet.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!

    typeInto(field('trips.create.name'), 'Winter escape')
    typeInto(field('trips.create.startsOn'), '2027-01-20')
    typeInto(field('trips.create.endsOn'), '2027-02-06')
    typeInto(field('trips.create.baseCurrency'), 'eur')
    sheet.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle(fixture)

    expect(fakes.trips.calls).toContain('create:Winter escape')
    const created = fakes.trips.trips[0]
    expect(created?.baseCurrency).toBe('EUR')
    // The client picks the id (idempotent retries), so it is a UUID, never a server counter.
    expect(created?.id).toMatch(/^[0-9a-f-]{36}$/)
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['/t', created!.id, 'today']))
    expect((await db.trips.get(created!.id))?.name).toBe('Winter escape')
  })

  it('the sheet refuses an end before the start without calling the server', async () => {
    const { fixture, host } = await render()
    host.querySelector<HTMLElement>('[data-testid="trips.create"]')!.click()
    await settle(fixture)
    const sheet = document.querySelector('.cdk-overlay-container')!
    const field = (id: string) => sheet.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!

    typeInto(field('trips.create.name'), 'Winter escape')
    typeInto(field('trips.create.startsOn'), '2027-02-06')
    typeInto(field('trips.create.endsOn'), '2027-01-20')
    typeInto(field('trips.create.baseCurrency'), 'EUR')
    sheet.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle(fixture)

    expect(fakes.trips.calls.filter((call) => call.startsWith('create'))).toEqual([])
    expect(sheet.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0)
  })
})
