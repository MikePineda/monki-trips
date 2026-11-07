import { TestBed } from '@angular/core/testing'
import { signal } from '@angular/core'
import { documentRow } from '../../../testing/fake-documents-api'
import {
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import type { MonkiTripsDb } from './db'
import { toDocumentRecord } from './document-record'
import { OfflineReadinessStore } from './offline-readiness.store'

describe('OfflineReadinessStore', () => {
  let db: MonkiTripsDb

  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    TestBed.configureTestingModule({ providers: provideOfflineTesting({ db }) })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  function readiness() {
    return TestBed.runInInjectionContext(() =>
      TestBed.inject(OfflineReadinessStore).documentsFor(signal('trip-1'))
    )
  }

  const copy = (docId: string, sha256: string) => ({
    docId,
    sha256,
    size: 1,
    mime: 'application/pdf',
    blob: new Blob(['x']),
    savedAt: '2026-11-07T12:00:00.000Z',
  })

  it('ready when every file has a copy with the server hash; links need none', async () => {
    await db.docs.bulkPut([
      toDocumentRecord(documentRow({ id: 'a', sha256: 'aaa' })),
      toDocumentRecord(documentRow({ id: 'l', kind: 'link', url: 'https://example.com' })),
    ])
    await db.docBlobs.put(copy('a', 'aaa'))
    const ready = readiness()

    await vi.waitFor(() =>
      expect(ready()).toMatchObject({ ready: true, total: 1, documentIds: [] })
    )
  })

  it('not ready when a doc hash mismatches or a file has no copy', async () => {
    await db.docs.bulkPut([
      toDocumentRecord(documentRow({ id: 'a', sha256: 'aaa' })),
      toDocumentRecord(documentRow({ id: 'b', sha256: 'bbb' })),
      toDocumentRecord(documentRow({ id: 'other-trip', tripId: 'trip-2', sha256: 'x' })),
    ])
    await db.docBlobs.put(copy('a', 'stale'))
    const ready = readiness()

    await vi.waitFor(() =>
      expect(ready()).toMatchObject({ ready: false, total: 2, documentIds: ['a', 'b'] })
    )
  })
})
