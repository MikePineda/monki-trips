import { TestBed } from '@angular/core/testing'
import { FakeDeviceStorage } from '../../../testing/fake-device-storage'
import { FakeDocumentsApi, documentRow } from '../../../testing/fake-documents-api'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from './db'
import { DocumentCopiesStore } from './document-copies.store'

const BYTES = '%PDF-voucher'
const BYTES_SHA = '11ab3b6b17c86444aa1357652cbcb92886fa5a53315409760f52512eabe6d76f'

describe('DocumentCopiesStore', () => {
  let db: MonkiTripsDb
  let api: FakeDocumentsApi
  let storage: FakeDeviceStorage
  let copies: DocumentCopiesStore

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    api = new FakeDocumentsApi()
    storage = new FakeDeviceStorage()
    TestBed.configureTestingModule({
      providers: provideOfflineTesting({ db, documents: api, storage }),
    })
    copies = TestBed.inject(DocumentCopiesStore)
    api.files.set('doc-1', new Blob([BYTES], { type: 'application/pdf' }))
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  it('saved offline verifies the sha256 and flags a mismatch', async () => {
    const good = await copies.save(documentRow({ id: 'doc-1', sha256: BYTES_SHA }))

    expect(good).toEqual({ verified: true, sha256: BYTES_SHA })
    const stored = await db.docBlobs.get('doc-1')
    expect(stored).toMatchObject({ docId: 'doc-1', sha256: BYTES_SHA, size: BYTES.length })
    expect(api.calls).toEqual(['download:trip-1/doc-1'])

    const bad = await copies.save(documentRow({ id: 'doc-1', sha256: 'f'.repeat(64) }))
    expect(bad.verified).toBe(false)
    await vi.waitFor(() => expect(copies.copies().get('doc-1')?.sha256).toBe(BYTES_SHA))
  })

  it('asks the browser to persist storage the first time only', async () => {
    await copies.save(documentRow({ id: 'doc-1' }))
    await copies.save(documentRow({ id: 'doc-1' }))

    expect(storage.persistCalls).toBe(1)
  })

  it('is saving while the bytes are on their way, and not after a failure', async () => {
    api.failWith = new TypeError('Failed to fetch')
    const pending = copies.save(documentRow({ id: 'doc-1' }))
    expect(copies.saving().has('doc-1')).toBe(true)

    await expect(pending).rejects.toThrow('Failed to fetch')
    expect(copies.saving().has('doc-1')).toBe(false)
    expect(await db.docBlobs.count()).toBe(0)
  })

  it('storage warning above half the free quota', async () => {
    storage.estimateBytes = { usage: 100, quota: 1100 }

    expect((await copies.status(400)).warning).toBe(false)
    expect(await copies.status(501)).toMatchObject({ warning: true, freeBytes: 1000 })
  })
})
