import 'fake-indexeddb/auto'
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting } from '../../../../testing/api-testing'
import { DEMO_TRIP_ID, DEMO_TRIP_RECORD, placedEvent } from '../../../../testing/fake-trip-content'
import { i18nTesting } from '../../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../../testing/offline-testing'
import { settle } from '../../../../testing/settle'
import type { MonkiTripsDb } from '../../../core/offline/db'
import { toDocumentRecord } from '../../../core/offline/document-record'
import { documentRow } from '../../../../testing/fake-documents-api'
import { EventDetailSheet, type EventDetailData } from './event-detail.sheet'

const INN = placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
  id: 'inn',
  kind: 'lodging',
  title: 'Harbour Inn',
  endsLocal: '2027-01-22T11:00',
  address: '14 Quay Lane',
  bookingCode: 'HBR7742',
  costMinor: 126_000,
  costCurrency: 'THB',
})

describe('EventDetailSheet', () => {
  let db: MonkiTripsDb
  let closed: number

  async function render(userAgent: string) {
    closed = 0
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    TestBed.configureTestingModule({
      imports: [EventDetailSheet, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(apiFakes()),
        provideRouter([]),
        {
          provide: DIALOG_DATA,
          useValue: { tripId: DEMO_TRIP_ID, eventId: 'inn' } satisfies EventDetailData,
        },
        { provide: DialogRef, useValue: { close: () => (closed += 1) } },
      ],
    })
    await db.trips.put(DEMO_TRIP_RECORD)
    await db.events.put(INN)
    const fixture = TestBed.createComponent(EventDetailSheet)
    fixture.detectChanges()
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[data-testid="events.detail"]')
      ).not.toBeNull()
    })
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  it('shows every field of the event', async () => {
    const { host } = await render('Mozilla/5.0 (Linux; Android 14) Chrome/130')

    expect(host.querySelector('[data-testid="events.detail.starts"]')?.textContent).toContain(
      'Wed 20 Jan 15:00'
    )
    expect(host.querySelector('[data-testid="events.detail.address"]')?.textContent).toContain(
      '14 Quay Lane'
    )
    expect(host.querySelector('[data-testid="events.detail.bookingCode"]')?.textContent).toContain(
      'HBR7742'
    )
    expect(host.querySelector('[data-testid="events.detail.cost"]')?.textContent).toContain('1,260')
    expect(host.querySelector('[data-testid="events.detail.documents"]')).not.toBeNull()
  })

  it('lists the documents linked to the event, each opening in the docs tab', async () => {
    await db.docs.bulkPut([
      toDocumentRecord(
        documentRow({ id: 'voucher', tripId: DEMO_TRIP_ID, eventId: 'inn', title: 'Inn voucher' })
      ),
      toDocumentRecord(
        documentRow({ id: 'other', tripId: DEMO_TRIP_ID, eventId: null, title: 'Visa' })
      ),
    ])
    const { fixture, host } = await render('Mozilla/5.0 (Linux; Android 14) Chrome/130')

    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(host.querySelectorAll('[data-testid="events.detail.document"]')).toHaveLength(1)
    })
    const link = host.querySelector('[data-testid="events.detail.document"]')
    expect(link?.textContent).toContain('Inn voucher')
    expect(link?.getAttribute('href')).toBe(`/t/${DEMO_TRIP_ID}/docs/voucher`)
  })

  it('directions link follows the platform', async () => {
    const android = await render('Mozilla/5.0 (Linux; Android 14) Chrome/130')
    expect(
      android.host.querySelector('[data-testid="events.detail.directions"]')?.getAttribute('href')
    ).toBe('https://www.google.com/maps/dir/?api=1&destination=14%20Quay%20Lane')
    TestBed.resetTestingModule()

    const ios = await render('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')
    expect(
      ios.host.querySelector('[data-testid="events.detail.directions"]')?.getAttribute('href')
    ).toBe('https://maps.apple.com/?daddr=14%20Quay%20Lane')
  })

  it('the night override is written through the outbox', async () => {
    const { fixture, host } = await render('Mozilla/5.0 (Linux; Android 14) Chrome/130')

    ;(
      host.querySelector('[data-testid="events.detail.coversNight.no"]') as HTMLButtonElement
    ).click()
    await settle(fixture, 6)

    expect(await db.events.get('inn')).toMatchObject({ coversNight: false, syncState: 'pending' })
    expect(await db.outbox.toArray()).toMatchObject([
      { kind: 'event.upsert', payload: { entity: 'event', changes: { coversNight: false } } },
    ])
  })

  it('deleting removes the event at once, closes the sheet and offers undo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { fixture } = await render('Mozilla/5.0 (Linux; Android 14) Chrome/130')
    const sheet = fixture.componentInstance as unknown as { remove(): Promise<void> }

    await sheet.remove()

    expect(await db.events.get('inn')).toBeUndefined()
    expect(closed).toBe(1)
    expect(await db.outbox.count()).toBe(0)
    vi.useRealTimers()
  })
})
