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
import TripsPage from './trips.page'

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

  beforeEach(() => {
    db = freshOfflineDb()
    fakes = apiFakes()
    TestBed.configureTestingModule({
      imports: [TripsPage, i18nTesting()],
      providers: [...provideOfflineTesting({ db }), ...provideApiTesting(fakes), provideRouter([])],
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
    expect(link.textContent).toContain('2027-01-20 to 2027-02-06')
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
