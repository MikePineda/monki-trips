import 'fake-indexeddb/auto'
import { Dialog } from '@angular/cdk/dialog'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import type { HealthReport } from '@monkitrips/shared'
import { apiFakes, provideApiTesting } from '../../../testing/api-testing'
import { FakeCacheStorage } from '../../../testing/fake-cache-storage'
import { FakeDeviceStorage } from '../../../testing/fake-device-storage'
import { FakeDocumentsApi } from '../../../testing/fake-documents-api'
import { DEMO_TRIP_ID, DEMO_TRIP_RECORD, blankDocument } from '../../../testing/fake-trip-content'
import { i18nTesting } from '../../../testing/i18n-testing'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { providePwaTesting } from '../../../testing/pwa-testing'
import { settle } from '../../../testing/settle'
import { HEALTH_API } from '../../core/api/health-api'
import type { MonkiTripsDb } from '../../core/offline/db'
import { toDocumentRecord } from '../../core/offline/document-record'
import { META_LAST_OFFLINE_BOOT_AT, META_LAST_PULL_AT } from '../../core/offline/meta.store'
import { sha256Hex } from '../../core/offline/sha256'
import { TIME_ZONE } from '../../core/offline/time-zone'
import {
  CACHE_STORAGE,
  LOCALE_ASSETS,
  MASCOT_ASSETS,
  SERVICE_WORKER_CONTAINER,
} from '../../core/pwa/asset-cache'
import OfflinePage from './offline.page'

const NOW = '2027-01-08T06:00:00.000Z'

const REPORT: HealthReport = {
  status: 'ok',
  version: '0.4.0',
  sha: 'abc1234',
} as HealthReport

describe('OfflinePage (Ready to fly)', () => {
  let db: MonkiTripsDb
  let caches: FakeCacheStorage
  let storage: FakeDeviceStorage
  let documents: FakeDocumentsApi
  let online: boolean

  const url = (path: string) => new URL(path, document.baseURI).href

  beforeEach(() => {
    online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    db = freshOfflineDb()
    caches = new FakeCacheStorage()
    storage = new FakeDeviceStorage()
    documents = new FakeDocumentsApi()
    // The worker answers every asset fetch and keeps it, like ngsw does.
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      caches.put(String(input))
      return new Response('{}')
    })
    TestBed.configureTestingModule({
      imports: [OfflinePage, i18nTesting()],
      providers: [
        ...provideOfflineTesting({ db, clock: new TestClock(NOW), documents, storage }),
        ...provideApiTesting(apiFakes()),
        providePwaTesting(),
        provideRouter([]),
        { provide: TIME_ZONE, useValue: 'Australia/Sydney' },
        { provide: HEALTH_API, useValue: { health: async () => REPORT } },
        { provide: CACHE_STORAGE, useValue: caches },
        { provide: SERVICE_WORKER_CONTAINER, useValue: { controller: {} } },
      ],
    })
  })

  afterEach(async () => {
    TestBed.inject(Dialog).closeAll()
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  async function servedDocument(id: string, text: string) {
    const blob = new Blob([text], { type: 'application/pdf' })
    const doc = toDocumentRecord(blankDocument({ id, title: id, sha256: await sha256Hex(blob) }))
    await db.docs.put(doc)
    documents.files.set(id, blob)
    return { doc, blob }
  }

  /** Everything green but the documents: a fresh pull, cached assets, persisted storage. */
  async function readyButDocuments() {
    await db.trips.put(DEMO_TRIP_RECORD)
    await db.meta.put({ key: META_LAST_PULL_AT, value: '2027-01-08T05:00:00.000Z' })
    for (const path of [...LOCALE_ASSETS, ...MASCOT_ASSETS]) {
      caches.put(url(path))
    }
    storage.isPersisted = true
  }

  async function render() {
    const fixture = TestBed.createComponent(OfflinePage)
    fixture.componentRef.setInput('tripId', DEMO_TRIP_ID)
    fixture.detectChanges()
    await settle(fixture)
    const host = fixture.nativeElement as HTMLElement
    const text = (testId: string) =>
      host.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ??
      ''
    const until = async (check: () => void) =>
      vi.waitFor(() => {
        fixture.detectChanges()
        check()
      })
    return { fixture, host, text, until }
  }

  it('lists the seven checks with live data and says when the phone is ready', async () => {
    await readyButDocuments()
    const { doc, blob } = await servedDocument('ticket', '%PDF-1.4 ticket')
    await db.docBlobs.put({
      docId: doc.id,
      sha256: doc.sha256!,
      size: blob.size,
      mime: 'application/pdf',
      blob,
      savedAt: NOW,
    })
    const { host, text, until } = await render()

    await until(() => expect(text('offline.ready.summary')).toBe('This phone is ready to fly'))
    const rows = [...host.querySelectorAll('[data-testid^="offline.check."]')].map((row) =>
      row.getAttribute('data-testid')
    )
    expect(rows).toEqual([
      'offline.check.version',
      'offline.check.snapshot',
      'offline.check.documents',
      'offline.check.assets',
      'offline.check.storage',
      'offline.check.outbox',
      'offline.check.installed',
    ])
    expect(text('offline.check.version')).toContain('Version 0.4.0')
    expect(text('offline.check.snapshot')).toMatch(/Synced 1 hr/)
    expect(text('offline.check.documents')).toContain('1 file saved and verified')
    expect(text('offline.check.installed')).toContain('Not needed on this device')
    expect(host.querySelector('[data-testid^="offline.fix."]')).toBeNull()
  })

  it('ready to fly is red when a document hash mismatches', async () => {
    await readyButDocuments()
    const { doc } = await servedDocument('ticket', '%PDF-1.4 ticket')
    await db.docBlobs.put({
      docId: doc.id,
      sha256: 'f'.repeat(64),
      size: 3,
      mime: 'application/pdf',
      blob: new Blob(['old']),
      savedAt: NOW,
    })
    const { host, text, until } = await render()

    await until(() => expect(text('offline.ready.summary')).toBe('1 thing to fix before you fly'))
    expect(
      host.querySelector('[data-testid="offline.ready.summary"]')?.getAttribute('data-ready')
    ).toBe('false')
    expect(text('offline.check.documents')).toContain('1 file is missing or out of date')
    expect(text('offline.check.documents')).toContain('To fix')

    ;(host.querySelector('[data-testid="offline.fix.documents"]') as HTMLButtonElement).click()

    await until(() => expect(text('offline.ready.summary')).toBe('This phone is ready to fly'))
    expect((await db.docBlobs.get('ticket'))?.sha256).toBe(doc.sha256)
  })

  it('download everything saves every document and warms the caches', async () => {
    await db.trips.put(DEMO_TRIP_RECORD)
    await servedDocument('ticket', '%PDF-1.4 ticket')
    await servedDocument('voucher', '%PDF-1.4 voucher')
    const { host, text, until } = await render()
    await until(() =>
      expect(text('offline.ready.summary')).toContain('things to fix before you fly')
    )

    ;(host.querySelector('[data-testid="offline.download.action"]') as HTMLButtonElement).click()

    await until(() => expect(text('offline.download.outcome')).toBe('Everything is on this phone'))
    expect(text('offline.ready.summary')).toBe('This phone is ready to fly')
    expect((await db.docBlobs.toArray()).map((blob) => blob.docId).sort()).toEqual([
      'ticket',
      'voucher',
    ])
    expect(storage.persistCalls).toBe(1)
    for (const path of [...LOCALE_ASSETS, ...MASCOT_ASSETS]) {
      expect(await caches.match(url(path)), path).toBeDefined()
    }
    expect(await db.meta.get(META_LAST_PULL_AT)).toEqual({ key: META_LAST_PULL_AT, value: NOW })
  })

  it('download everything needs a connection and says so', async () => {
    online = false
    await db.trips.put(DEMO_TRIP_RECORD)
    const { host, text, until } = await render()

    ;(host.querySelector('[data-testid="offline.download.action"]') as HTMLButtonElement).click()

    await until(() =>
      expect(text('offline.download.outcome')).toBe('You need a connection for this')
    )
  })

  it('shows the date of the last cold start without network', async () => {
    await db.trips.put(DEMO_TRIP_RECORD)
    const { text, until } = await render()
    await until(() =>
      expect(text('offline.airplane.never')).toBe('Not tested offline on this phone yet')
    )

    await db.meta.put({ key: META_LAST_OFFLINE_BOOT_AT, value: '2027-01-08T06:30:00.000Z' })

    // 17:30 in Sydney on the 8th.
    await until(() =>
      expect(text('offline.airplane.tested')).toBe('Tested offline on Fri 8 Jan 17:30')
    )
  })

  it('storage that is not persisted asks to keep it', async () => {
    await readyButDocuments()
    storage.isPersisted = false
    const { host, text, until } = await render()
    await until(() =>
      expect(text('offline.check.storage')).toContain('The browser may clear the data')
    )

    ;(host.querySelector('[data-testid="offline.fix.storage"]') as HTMLButtonElement).click()

    await until(() => expect(text('offline.ready.summary')).toBe('This phone is ready to fly'))
    expect(storage.persistCalls).toBe(1)
  })
})
