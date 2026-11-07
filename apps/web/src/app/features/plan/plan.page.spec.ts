import 'fake-indexeddb/auto'
import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting } from '../../../testing/api-testing'
import {
  DEMO_TRIP_ID,
  DEMO_TRIP_RECORD,
  blankSegment,
  placedEvent,
} from '../../../testing/fake-trip-content'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { DEVICE_TIME_ZONE } from '../../core/offline/device-zone'
import PlanPage from './plan.page'

describe('PlanPage', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    TestBed.configureTestingModule({
      imports: [PlanPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(apiFakes()),
        provideRouter([]),
        { provide: DEVICE_TIME_ZONE, useValue: 'Australia/Sydney' },
      ],
    })
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    await db.trips.put(DEMO_TRIP_RECORD)
    const fixture = TestBed.createComponent(PlanPage)
    fixture.componentRef.setInput('tripId', DEMO_TRIP_ID)
    fixture.detectChanges()
    await settle(fixture)
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  function texts(host: HTMLElement, selector: string): string[] {
    return [...host.querySelectorAll(selector)].map(
      (node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    )
  }

  it('lists one section per day with the events at the place local time and a free day', async () => {
    await db.events.bulkPut([
      placedEvent('2027-01-21T20:30', 'Asia/Bangkok', {
        id: 'train',
        kind: 'train',
        title: 'Night train',
        endsLocal: '2027-01-22T07:15',
        address: '1 Station Road',
      }),
      placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
        id: 'inn',
        kind: 'lodging',
        title: 'Harbour Inn',
        endsLocal: '2027-01-21T11:00',
      }),
    ])
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelectorAll('[data-testid="plan.day"]')).toHaveLength(5)
    })
    const days = [...host.querySelectorAll('[data-testid="plan.day"]')]
    expect(days.map((day) => day.getAttribute('data-date'))).toEqual([
      '2027-01-20',
      '2027-01-21',
      '2027-01-22',
      '2027-01-23',
      '2027-01-24',
    ])
    expect(texts(host, '[data-testid="plan.day.title"]')[0]).toBe('Wed 20 Jan')
    expect(days[0].textContent).toContain('Day 1 of 5')
    expect(days[0].textContent).toContain('Check-in · Harbour Inn')
    expect(days[0].textContent).toContain('Night 1 of 1')
    expect(days[1].textContent).toContain('Check-out · Harbour Inn')
    expect(days[1].textContent).toContain('20:30')
    // Bangkok is four hours behind the Sydney device: the zone shows.
    expect(days[1].querySelector('.mk-event__zone')?.textContent?.trim()).toBe('GMT+7')
    expect(days[2].textContent).toContain('Arrives · Night train')
    expect(days[3].querySelector('[data-testid="plan.day.free"]')?.textContent).toContain(
      'Free day'
    )
    const directions = days[1].querySelector('[data-testid="plan.event.directions"]')
    expect(directions?.getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=1%20Station%20Road'
    )
    expect(days[1].querySelector('[data-testid="plan.event"]')?.getAttribute('href')).toBe(
      '/t/trip-1/plan/e/train'
    )
  })

  it('a flight with legs shows the route chip of the day', async () => {
    await db.events.put(
      placedEvent('2027-01-20T09:30', 'Asia/Bangkok', { id: 'f1', kind: 'flight', title: 'Flight' })
    )
    await db.segments.put(
      blankSegment({ id: 'g1', eventId: 'f1', departsLocal: '2027-01-20T09:30' })
    )
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="plan.day.chips"]')?.textContent).toMatch(
        /PVM\s*→\s*ALD/
      )
    })
  })

  it('where we sleep lists the nights, the alert and a way to find a stay', async () => {
    await db.events.put(
      placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
        id: 'inn',
        kind: 'lodging',
        title: 'Harbour Inn',
        endsLocal: '2027-01-22T11:00',
      })
    )
    const router = TestBed.inject(Router)
    vi.spyOn(router, 'url', 'get').mockReturnValue('/t/trip-1/plan/nights')
    const { fixture, host } = await render()

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelectorAll('[data-testid="plan.night"]')).toHaveLength(4)
    })
    expect(host.querySelector('[data-testid="plan.nights.uncovered"]')?.textContent).toContain(
      '2 nights without a place to sleep'
    )
    expect(host.querySelector('[data-testid="plan.nights.counts"]')?.textContent).toMatch(
      /4 nights\s*·\s*2 in lodging\s*·\s*0 on the way/
    )
    expect(texts(host, '[data-testid="plan.night"]')[0]).toContain('Harbour Inn')
    expect(texts(host, '[data-testid="plan.night"]')[2]).toContain('No stay')

    ;(host.querySelector('[data-testid="plan.night.findStay"]') as HTMLButtonElement).click()
    await settle(fixture)

    const kind = document.querySelector('[data-testid="events.form.kind"]') as HTMLSelectElement
    expect(kind.value).toBe('lodging')
    expect(
      (document.querySelector('[data-testid="events.form.startDate"]') as HTMLInputElement).value
    ).toBe('2027-01-22')
    expect(
      (document.querySelector('[data-testid="events.form.endDate"]') as HTMLInputElement).value
    ).toBe('2027-01-23')
  })

  it('adding an event writes it to the device and the outbox at once', async () => {
    await db.stops.put({
      id: 's1',
      tripId: DEMO_TRIP_ID,
      position: 0,
      name: 'Port Vellmar',
      countryCode: 'XA',
      lat: null,
      lng: null,
      tz: 'Asia/Bangkok',
      arriveOn: '2027-01-20',
      departOn: '2027-01-24',
      deletedAt: null,
      updatedAt: 'x',
    })
    const { fixture, host } = await render()
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelector('[data-testid="plan.add"]')).not.toBeNull()
    })
    ;(host.querySelector('[data-testid="plan.add"]') as HTMLButtonElement).click()
    await settle(fixture)
    const input = (id: string) =>
      document.querySelector(`[data-testid="events.form.${id}"]`) as HTMLInputElement

    typeInto(input('title'), 'Harbour walk')
    typeInto(input('startDate'), '2027-01-21')
    typeInto(input('startTime'), '09:30')
    await settle(fixture)
    expect((input('startTz') as unknown as HTMLSelectElement).value).toBe('Asia/Bangkok')
    document
      .querySelector('[data-testid="events.form.submit"]')!
      .closest('form')!
      .dispatchEvent(new Event('submit'))
    await settle(fixture, 6)

    const [event] = await db.events.toArray()
    expect(event).toMatchObject({
      title: 'Harbour walk',
      startsLocal: '2027-01-21T09:30',
      startTz: 'Asia/Bangkok',
      startsOn: '2027-01-21',
      syncState: 'pending',
    })
    expect(await db.outbox.toArray()).toMatchObject([
      { entity: 'event', op: 'upsert', rowId: event.id },
    ])
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.textContent).toContain('Harbour walk')
    })
    expect(host.textContent).toContain('Pending')
  })
})
