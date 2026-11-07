import { TestBed } from '@angular/core/testing'
import { Router, provideRouter } from '@angular/router'
import { DEMO_TRIP_RECORD } from '../../../testing/fake-trip-content'
import { FakeDocumentsApi } from '../../../testing/fake-documents-api'
import { FakeShareInbox, sharedItem } from '../../../testing/fake-share-inbox'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { META_ACTIVE_TRIP } from '../../core/offline/meta.store'
import ShareInboxPage from './share-inbox.page'

describe('ShareInboxPage', () => {
  let db: MonkiTripsDb
  let api: FakeDocumentsApi
  let inbox: FakeShareInbox

  beforeEach(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    db = freshOfflineDb()
    api = new FakeDocumentsApi()
    inbox = new FakeShareInbox([
      sharedItem({ id: 'pass', name: 'boarding-pass.pdf' }),
      sharedItem({ id: 'zip', name: 'archive.zip', type: 'application/zip' }),
    ])
    TestBed.configureTestingModule({
      imports: [ShareInboxPage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, documents: api, shareInbox: inbox }),
        provideRouter([{ path: '**', children: [] }]),
      ],
    })
    await db.trips.bulkPut([
      { ...DEMO_TRIP_RECORD, id: 'trip-1', name: 'Harbour and hills', startDate: '2027-01-20' },
      { ...DEMO_TRIP_RECORD, id: 'trip-2', name: 'Winter coast', startDate: '2027-06-01' },
    ])
    await db.meta.put({ key: META_ACTIVE_TRIP, value: 'trip-1' })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(ShareInboxPage)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    const until = (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    return { fixture, host, until }
  }

  it('share target inbox uploads to the chosen trip', async () => {
    const { fixture, host, until } = await render()
    await until(() => expect(host.querySelectorAll('[data-testid="share.item"]')).toHaveLength(2))
    await until(() =>
      expect(host.querySelector<HTMLSelectElement>('[data-testid="share.trip"]')?.value).toBe(
        'trip-1'
      )
    )
    // The zip cannot be added: the row says why and it is left out.
    expect(host.textContent).toContain('Not a PDF or an image')

    const trip = host.querySelector<HTMLSelectElement>('[data-testid="share.trip"]')!
    trip.value = 'trip-2'
    trip.dispatchEvent(new Event('change'))
    host.querySelector<HTMLButtonElement>('[data-testid="share.tag.print"] button')!.click()
    await settle(fixture)
    host.querySelector<HTMLButtonElement>('[data-testid="share.submit"]')!.click()

    await vi.waitFor(() => expect(api.uploads).toHaveLength(1))
    expect(api.uploads[0]).toMatchObject({
      tripId: 'trip-2',
      title: 'boarding-pass',
      fileName: 'boarding-pass.pdf',
      tags: ['print'],
    })
    await vi.waitFor(() => expect(inbox.items.map((item) => item.id)).toEqual(['zip']))
    await vi.waitFor(async () =>
      expect((await db.docs.toArray()).map((d) => d.tripId)).toEqual(['trip-2'])
    )
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/t/trip-2/docs'))
  })

  it('an empty inbox says so', async () => {
    inbox.items = []
    const { host, until } = await render()

    await until(() => expect(host.querySelector('[data-testid="share.empty"]')).not.toBeNull())
  })

  it('a share the service worker could not keep shows the error', async () => {
    const { fixture, host, until } = await render()
    fixture.componentRef.setInput('error', 'store')

    await until(() => expect(host.querySelector('[data-testid="share.storeError"]')).not.toBeNull())
  })
})
