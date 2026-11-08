import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import type { AiAction } from '@monkitrips/shared'
import { FAKE_APP_CONFIG, FakeAuthApi } from '../../../testing/fake-auth-api'
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
import { ApiFailure } from '../../core/api/api-failure'
import { AUTH_API } from '../../core/api/auth-api'
import type { MonkiTripsDb } from '../../core/offline/db'
import { DocumentCopiesStore } from '../../core/offline/document-copies.store'
import { toDocumentRecord } from '../../core/offline/document-record'
import { PDF_RENDERER } from '../../shared/ui/document-preview/pdf-renderer'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { BOOKING_EXTRACTION_API, type BookingExtractionApi } from './booking-extraction-api'
import { BookingReviewSheet } from './booking-review.sheet'
import { DocumentDetailSheet, type DocumentDetailData } from './document-detail.sheet'

const BYTES = '%PDF-voucher'
const BYTES_SHA = '11ab3b6b17c86444aa1357652cbcb92886fa5a53315409760f52512eabe6d76f'

/** A proposed extract_booking action; the review sheet's own spec covers its contents. */
const PROPOSED = { id: 'act-1', tool: 'extract_booking', status: 'proposed' } as AiAction

/** The extraction routes, answering what the spec sets. */
class ScriptedExtractionApi implements BookingExtractionApi {
  extracted: string[] = []
  answer: () => Promise<AiAction> = () => Promise.resolve(PROPOSED)

  extract(_tripId: string, documentId: string): Promise<AiAction> {
    this.extracted.push(documentId)
    return this.answer()
  }

  revise(): Promise<AiAction> {
    return Promise.reject(new Error('not used here'))
  }

  accept(): Promise<AiAction> {
    return Promise.reject(new Error('not used here'))
  }

  reject(): Promise<AiAction> {
    return Promise.reject(new Error('not used here'))
  }
}

describe('DocumentDetailSheet', () => {
  let db: MonkiTripsDb
  let api: FakeDocumentsApi
  let storage: FakeDeviceStorage
  let rendered: number
  let extraction: ScriptedExtractionApi
  let auth: FakeAuthApi

  beforeEach(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    db = freshOfflineDb()
    api = new FakeDocumentsApi()
    storage = new FakeDeviceStorage()
    rendered = 0
    extraction = new ScriptedExtractionApi()
    auth = new FakeAuthApi()
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
        { provide: BOOKING_EXTRACTION_API, useValue: extraction },
        { provide: AUTH_API, useValue: auth },
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

  it('read this booking is offered only for pdf and image files and only online', async () => {
    const offered = async (overrides: Parameters<typeof documentRow>[0]) => {
      await db.docs.put(toDocumentRecord(documentRow({ id: 'voucher', ...overrides })))
      const { fixture, host } = await render()
      const button = host.querySelector('[data-testid="docs.detail.readBooking"]')
      const answer = button ? (button.hasAttribute('disabled') ? 'disabled' : 'enabled') : 'absent'
      fixture.destroy()
      return answer
    }

    expect(await offered({ mime: 'application/pdf' })).toBe('enabled')
    expect(await offered({ mime: 'image/jpeg' })).toBe('enabled')
    expect(await offered({ mime: 'text/plain' })).toBe('absent')
    expect(await offered({ mime: null })).toBe('absent')
    expect(
      await offered({
        kind: 'link',
        mime: null,
        url: 'https://example.com/voucher',
        sizeBytes: null,
      })
    ).toBe('absent')

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    await db.docs.put(toDocumentRecord(documentRow({ id: 'voucher' })))
    const { host } = await render()
    expect(
      host.querySelector('[data-testid="docs.detail.readBooking"]')?.hasAttribute('disabled')
    ).toBe(true)
    expect(host.querySelector('[data-testid="docs.detail.readOffline"]')?.textContent).toContain(
      'You need a connection to read a booking.'
    )
  })

  it('a document already linked to an event is not offered for reading', async () => {
    await db.docs.put(toDocumentRecord(documentRow({ id: 'voucher', eventId: 'ev-1' })))
    const { host } = await render()

    expect(host.querySelector('[data-testid="docs.detail.readBooking"]')).toBeNull()
    expect(host.querySelector('[data-testid="docs.detail.readLinked"]')?.textContent).toContain(
      'already attached to an event in the plan'
    )
  })

  it('read this booking is hidden for a photo while the server cannot read photos', async () => {
    auth.appConfig = { ...FAKE_APP_CONFIG, visionEnabled: false }
    await db.docs.put(toDocumentRecord(documentRow({ id: 'voucher', mime: 'image/jpeg' })))
    const photo = await render()

    await photo.until(() =>
      expect(photo.host.querySelector('[data-testid="docs.detail.readBooking"]')).toBeNull()
    )
    expect(auth.calls).toContain('config')
    photo.fixture.destroy()

    await db.docs.put(toDocumentRecord(documentRow({ id: 'voucher', mime: 'application/pdf' })))
    const pdf = await render()
    await settle(pdf.fixture)
    const button = pdf.host.querySelector('[data-testid="docs.detail.readBooking"]')
    expect(button).not.toBeNull()
    expect(button?.hasAttribute('disabled')).toBe(false)
  })

  it('read this booking says the file is sent to the ai provider', async () => {
    const { host } = await render()

    expect(host.querySelector('[data-testid="docs.detail.readPrivacy"]')?.textContent).toContain(
      'The file is sent to the AI provider'
    )
  })

  it('read this booking shows kiko thinking, then opens the proposal for review', async () => {
    let answer!: (action: AiAction) => void
    extraction.answer = () => new Promise((resolve) => (answer = resolve))
    const open = vi.spyOn(TestBed.inject(SheetService), 'open').mockReturnValue(null as never)
    const { host, until, click } = await render()

    await click('docs.detail.readBooking')

    await until(() =>
      expect(host.querySelector('[data-testid="docs.detail.reading"] mk-mascot')).not.toBeNull()
    )
    expect(
      host
        .querySelector('[data-testid="docs.detail.reading"] mk-mascot')
        ?.getAttribute('data-state')
    ).toBe('thinking')
    answer(PROPOSED)
    await until(() => expect(open).toHaveBeenCalledTimes(1))
    expect(open.mock.calls[0][0]).toBe(BookingReviewSheet)
    expect(open.mock.calls[0][1]?.data).toEqual({ tripId: 'trip-1', action: PROPOSED })
    expect(extraction.extracted).toEqual(['voucher'])
    await until(() => expect(host.querySelector('[data-testid="docs.detail.reading"]')).toBeNull())
  })

  it('extraction unavailable shows that the server cannot read scans', async () => {
    extraction.answer = () =>
      Promise.reject(
        new ApiFailure({
          kind: 'http',
          status: 503,
          code: 'E_EXTRACTION_UNAVAILABLE',
          message: 'No vision model',
        })
      )
    const { host, until, click } = await render()

    await click('docs.detail.readBooking')

    await until(() => {
      const error = host.querySelector('[data-testid="docs.detail.readError"]')
      expect(error?.getAttribute('data-code')).toBe('E_EXTRACTION_UNAVAILABLE')
      expect(error?.textContent).toContain('This server cannot read scans or photos')
      expect(error?.textContent).toContain('by hand')
    })
  })
})
