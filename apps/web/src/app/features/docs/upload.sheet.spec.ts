import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { DEMO_TRIP_RECORD } from '../../../testing/fake-trip-content'
import { FakeDocumentsApi } from '../../../testing/fake-documents-api'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { settle, typeInto } from '../../../testing/settle'
import type { MonkiTripsDb } from '../../core/offline/db'
import { CLIENT_MAX_DOCUMENT_BYTES } from '../../domain/document-upload-check'
import { UploadSheet, type UploadSheetData } from './upload.sheet'

describe('UploadSheet', () => {
  let db: MonkiTripsDb
  let api: FakeDocumentsApi
  let closedWith: unknown[]

  beforeEach(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    db = freshOfflineDb()
    api = new FakeDocumentsApi()
    closedWith = []
    TestBed.configureTestingModule({
      imports: [UploadSheet, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, documents: api }),
        {
          provide: DIALOG_DATA,
          useValue: {
            tripId: 'trip-1',
            events: [{ id: 'ferry', title: 'Ferry' }],
          } satisfies UploadSheetData,
        },
        { provide: DialogRef, useValue: { close: (value: unknown) => closedWith.push(value) } },
      ],
    })
    await db.trips.put(DEMO_TRIP_RECORD)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function render() {
    const fixture = TestBed.createComponent(UploadSheet)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const pick = async (file: File) => {
      const input = host.querySelector<HTMLInputElement>('[data-testid="docs.upload.file"]')!
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      input.dispatchEvent(new Event('change'))
      await settle(fixture)
    }
    const submit = async () => {
      host
        .querySelector<HTMLFormElement>('[data-testid="docs.upload"]')!
        .dispatchEvent(new Event('submit', { cancelable: true }))
      await settle(fixture)
    }
    return { fixture, host, pick, submit }
  }

  it('upload rejects files above the client limit before anything is sent', async () => {
    const { host, pick, submit } = await render()
    const big = new File([new Uint8Array(CLIENT_MAX_DOCUMENT_BYTES + 1)], 'scan.pdf', {
      type: 'application/pdf',
    })

    await pick(big)
    expect(host.textContent).toContain('This file is larger than 20 MB.')
    await submit()

    expect(api.calls).toEqual([])
    expect(closedWith).toEqual([])
  })

  it('a file of another type is refused on the device', async () => {
    const { host, pick } = await render()
    await pick(new File(['PK'], 'archive.zip', { type: 'application/zip' }))

    expect(host.textContent).toContain('Only PDFs and images can be added.')
  })

  it('uploads the picked file with its title, event and tags', async () => {
    const { fixture, host, pick, submit } = await render()
    await pick(new File(['%PDF-voucher'], 'ferry-voucher.pdf', { type: 'application/pdf' }))
    expect(host.querySelector<HTMLInputElement>('[data-testid="docs.upload.title"]')!.value).toBe(
      'ferry-voucher'
    )
    typeInto(
      host.querySelector<HTMLInputElement>('[data-testid="docs.upload.title"]')!,
      'Ferry voucher'
    )
    const event = host.querySelector<HTMLSelectElement>('[data-testid="docs.upload.event"]')!
    event.value = 'ferry'
    event.dispatchEvent(new Event('change'))
    host.querySelector<HTMLButtonElement>('[data-testid="docs.upload.tag.print"] button')!.click()
    await settle(fixture)

    await submit()

    await vi.waitFor(() => expect(closedWith).toEqual([{ added: true }]))
    expect(api.uploads[0]).toMatchObject({
      tripId: 'trip-1',
      title: 'Ferry voucher',
      eventId: 'ferry',
      tags: ['print'],
      fileName: 'ferry-voucher.pdf',
    })
  })

  it('offline, a file cannot be sent but a link can', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { fixture, host, submit } = await render()
    expect(host.querySelector('[data-testid="docs.upload.offline"]')).not.toBeNull()

    host.querySelector<HTMLButtonElement>('[data-testid="docs.upload.kind.link"]')!.click()
    await settle(fixture)
    typeInto(
      host.querySelector<HTMLInputElement>('[data-testid="docs.upload.url"]')!,
      'https://tickets.example.com/a'
    )
    typeInto(
      host.querySelector<HTMLInputElement>('[data-testid="docs.upload.title"]')!,
      'Museum tickets'
    )
    await submit()

    await vi.waitFor(() => expect(closedWith).toEqual([{ added: true }]))
    expect((await db.docs.toArray())[0]).toMatchObject({ kind: 'link', title: 'Museum tickets' })
    expect(await db.outbox.count()).toBe(1)
  })
})
