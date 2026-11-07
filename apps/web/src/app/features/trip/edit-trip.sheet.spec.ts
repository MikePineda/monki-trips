import 'fake-indexeddb/auto'
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { apiFakes, provideApiTesting } from '../../../testing/api-testing'
import { DEMO_TRIP_ID, DEMO_TRIP_RECORD } from '../../../testing/fake-trip-content'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { EditTripSheet, type EditTripData } from './edit-trip.sheet'

describe('EditTripSheet', () => {
  let db: MonkiTripsDb
  let closed: number

  async function render(data: EditTripData) {
    closed = 0
    TestBed.configureTestingModule({
      imports: [EditTripSheet, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db }),
        ...provideApiTesting(apiFakes()),
        provideRouter([]),
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: () => (closed += 1) } },
      ],
    })
    await db.trips.put(data.trip)
    const fixture = TestBed.createComponent(EditTripSheet)
    fixture.detectChanges()
    await settle(fixture)
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

  it('editor cannot edit owner-only fields', async () => {
    const { host } = await render({ trip: DEMO_TRIP_RECORD, role: 'editor' })
    const currency = host.querySelector(
      '[data-testid="trip.edit.baseCurrency"]'
    ) as HTMLInputElement

    expect(currency.disabled).toBe(true)
    expect(host.textContent).toContain('Only the trip owner can change this.')
    expect(
      (host.querySelector('[data-testid="trip.edit.name"]') as HTMLInputElement).disabled
    ).toBe(false)
  })

  it('the owner changes the base currency', async () => {
    const { host } = await render({ trip: DEMO_TRIP_RECORD, role: 'owner' })
    const currency = host.querySelector(
      '[data-testid="trip.edit.baseCurrency"]'
    ) as HTMLInputElement

    expect(currency.disabled).toBe(false)
  })

  it('saving queues only the fields that changed and updates the device row', async () => {
    const { fixture, host } = await render({ trip: DEMO_TRIP_RECORD, role: 'editor' })
    typeInto(host.querySelector('[data-testid="trip.edit.name"]') as HTMLInputElement, 'Hills only')
    typeInto(host.querySelector('[data-testid="trip.edit.budgetTotal"]') as HTMLInputElement, '500')
    fixture.detectChanges()

    host.querySelector('form')!.dispatchEvent(new Event('submit'))
    await settle(fixture, 6)

    const [entry] = await db.outbox.toArray()
    expect(entry).toMatchObject({
      kind: 'trip.upsert',
      payload: {
        entity: 'trip',
        op: 'upsert',
        id: DEMO_TRIP_ID,
        changes: { name: 'Hills only', budgetTotalMinor: 50_000 },
      },
    })
    expect(await db.trips.get(DEMO_TRIP_ID)).toMatchObject({
      name: 'Hills only',
      syncState: 'pending',
    })
    expect(closed).toBe(1)
  })
})
