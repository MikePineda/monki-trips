import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { DEMO_TRIP_RECORD } from '../../../testing/fake-trip-content'
import { FakeDeviceStorage } from '../../../testing/fake-device-storage'
import { FakeDocumentsApi, documentRow } from '../../../testing/fake-documents-api'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { DocumentCopiesStore } from '../../core/offline/document-copies.store'
import { toDocumentRecord } from '../../core/offline/document-record'
import { PDF_RENDERER } from '../../shared/ui/document-preview/pdf-renderer'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { DocumentDetailSheet, type DocumentDetailData } from './document-detail.sheet'

const BYTES = '%PDF-voucher'
const BYTES_SHA = '11ab3b6b17c86444aa1357652cbcb92886fa5a53315409760f52512eabe6d76f'

describe('DocumentDetailSheet', () => {
  let db: MonkiTripsDb
  let api: FakeDocumentsApi
  let storage: FakeDeviceStorage
  let rendered: number

  beforeEach(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    db = freshOfflineDb()
    api = new FakeDocumentsApi()
    storage = new FakeDeviceStorage()
    rendered = 0
    api.files.set('voucher', new Blob([BYTES], { type: 'application/pdf' }))
    TestBed.configureTestingModule({
      imports: [DocumentDetailSheet, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, documents: api, storage }),
        {
          provide: PDF_RENDERER,
          useValue: async () => {
            rendered += 1
            return { pages: 1, destroy: () => undefined }
          },
        },
        {
          provide: DIALOG_DATA,
          useValue: { tripId: 'trip-1', docId: 'voucher' } satisfies DocumentDetailData,
        },
        { provide: DialogRef, useValue: { close: () => undefined } },
      ],
    })
    await db.trips.put(DEMO_TRIP_RECORD)
    await db.docs.put(
      toDocumentRecord(documentRow({ id: 'voucher', title: 'Ferry voucher', sha256: BYTES_SHA }))
    )
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(DocumentDetailSheet)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    const until = (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    await until(() => expect(host.querySelector('[data-testid="docs.detail"]')).not.toBeNull())
    const click = async (id: string, inner = '') => {
      host.querySelector<HTMLElement>(`[data-testid="${id}"]${inner ? ` ${inner}` : ''}`)!.click()
      await settle(fixture)
    }
    return { fixture, host, until, click }
  }

  it('save offline stores the verified copy and asks for persistent storage', async () => {
    const { host, until, click } = await render()
    expect(host.querySelector('[data-testid="docs.detail.offline"]')?.textContent).toContain(
      'Not saved'
    )

    await click('docs.detail.saveOffline')

    await until(() =>
      expect(host.querySelector('[data-testid="docs.detail.offline"]')?.textContent).toContain(
        'Saved offline'
      )
    )
    expect(await db.docBlobs.get('voucher')).toMatchObject({ sha256: BYTES_SHA })
    expect(storage.persistCalls).toBe(1)
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Saved offline and verified')
  })

  it('a copy that differs from the server is flagged with a way to save it again', async () => {
    await db.docBlobs.put({
      docId: 'voucher',
      sha256: 'stale',
      size: 1,
      mime: 'application/pdf',
      blob: new Blob(['x']),
      savedAt: '2026-11-01T00:00:00Z',
    })
    const { host, until } = await render()

    await until(() =>
      expect(host.querySelector('[data-testid="docs.detail.mismatch"]')).not.toBeNull()
    )
  })

  it('storage warning above half the free quota', async () => {
    storage.estimateBytes = { usage: 900, quota: 1000 }
    await db.docBlobs.put({
      docId: 'voucher',
      sha256: BYTES_SHA,
      size: 600,
      mime: 'application/pdf',
      blob: new Blob(['x']),
      savedAt: '2026-11-01T00:00:00Z',
    })
    const { host, until } = await render()

    await until(() =>
      expect(host.querySelector('[data-testid="docs.detail.storageWarning"]')).not.toBeNull()
    )
  })

  it('quick view opens the saved copy without the network', async () => {
    await db.docBlobs.put({
      docId: 'voucher',
      sha256: BYTES_SHA,
      size: BYTES.length,
      mime: 'application/pdf',
      blob: new Blob([BYTES], { type: 'application/pdf' }),
      savedAt: '2026-11-01T00:00:00Z',
    })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    // fake-indexeddb cannot clone a jsdom Blob back into a Blob; a browser keeps it whole.
    const copies = TestBed.inject(DocumentCopiesStore)
    const stored = await copies.get('voucher')
    vi.spyOn(copies, 'get').mockResolvedValue({
      ...stored!,
      blob: new Blob([BYTES], { type: 'application/pdf' }),
    })
    const { host, until, click } = await render()

    await click('docs.detail.view')

    await until(() =>
      expect(host.querySelector('[data-testid="docs.detail.preview"]')).not.toBeNull()
    )
    await until(() => expect(rendered).toBe(1))
    expect(api.calls).toEqual([])
  })

  it('without a copy and without a connection the quick view says so', async () => {
    api.failWith = new TypeError('Failed to fetch')
    const { host, until, click } = await render()

    await click('docs.detail.view')

    await until(() =>
      expect(host.querySelector('[data-testid="docs.detail.needsConnection"]')).not.toBeNull()
    )
  })

  it('tags are edited in place and written through the outbox', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { click } = await render()

    await click('docs.detail.tag.print', 'button')

    await vi.waitFor(async () => expect((await db.docs.get('voucher'))?.tags).toEqual(['print']))
    await vi.waitFor(async () => expect(await db.outbox.count()).toBe(1))
    await vi.waitFor(async () =>
      expect((await db.tasks.toArray()).map((task) => task.sourceDocumentId)).toEqual(['voucher'])
    )
  })
})
