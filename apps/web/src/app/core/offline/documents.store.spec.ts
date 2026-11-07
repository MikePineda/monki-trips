import { TestBed } from '@angular/core/testing'
import { signal } from '@angular/core'
import { DEMO_TRIP_RECORD, blankEvent } from '../../../testing/fake-trip-content'
import { FakeDocumentsApi, documentRow } from '../../../testing/fake-documents-api'
import {
  TestClock,
  freshOfflineDb,
  provideOfflineTesting,
  resetOfflineTesting,
} from '../../../testing/offline-testing'
import { taskFixture } from '../../../testing/task-fixtures'
import { CLIENT_MAX_DOCUMENT_BYTES } from '../../domain/document-upload-check'
import type { MonkiTripsDb } from './db'
import { toDocumentRecord } from './document-record'
import { DocumentRejected, DocumentsStore } from './documents.store'
import { toEventRecord } from './event-record'
import { outboxMutation } from './mutation'
import { TIME_ZONE } from './time-zone'

describe('DocumentsStore', () => {
  let db: MonkiTripsDb
  let api: FakeDocumentsApi
  let store: DocumentsStore

  beforeEach(async () => {
    // Offline: queued mutations stay in the outbox where the spec can read them.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    db = freshOfflineDb()
    api = new FakeDocumentsApi()
    TestBed.configureTestingModule({
      providers: [
        ...provideOfflineTesting({ db, clock: new TestClock(), documents: api }),
        { provide: TIME_ZONE, useValue: 'UTC' },
      ],
    })
    store = TestBed.inject(DocumentsStore)
    await db.trips.put({ ...DEMO_TRIP_RECORD, startDate: '2027-01-20' })
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    await resetOfflineTesting(db)
  })

  const mutations = async () => (await db.outbox.toArray()).map((entry) => outboxMutation(entry))
  const printTasks = async () =>
    (await db.tasks.toArray()).filter((task) => task.origin === 'document')

  it('upload rejects files above the client limit', async () => {
    const big = new Blob([new Uint8Array(CLIENT_MAX_DOCUMENT_BYTES + 1)], {
      type: 'application/pdf',
    })

    const failure = await store
      .uploadFile({
        tripId: 'trip-1',
        file: big,
        fileName: 'big.pdf',
        title: 'Big',
        tags: [],
        eventId: null,
      })
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(DocumentRejected)
    expect((failure as DocumentRejected).reason).toBe('too_large')
    expect(api.calls).toEqual([])
    expect(await db.docs.count()).toBe(0)
  })

  it('an upload keeps the server row on the device', async () => {
    const record = await store.uploadFile({
      tripId: 'trip-1',
      file: new Blob(['%PDF-voucher'], { type: 'application/pdf' }),
      fileName: 'voucher.pdf',
      title: ' Ferry voucher ',
      tags: ['show_on_phone'],
      eventId: null,
    })

    expect(api.uploads[0]).toMatchObject({ title: 'Ferry voucher', tags: ['show_on_phone'] })
    expect(await db.docs.get(record.id)).toMatchObject({ kind: 'file', title: 'Ferry voucher' })
    expect(await db.outbox.count()).toBe(0)
  })

  it('print tag creates the print task mutation', async () => {
    await db.docs.put(toDocumentRecord(documentRow({ id: 'doc-1', title: 'Ferry voucher' })))

    await store.update('doc-1', { tags: ['print'] })

    // The document mutation carries the tag: the server makes the print task from it.
    expect(await mutations()).toEqual([
      expect.objectContaining({
        entity: 'document',
        op: 'upsert',
        id: 'doc-1',
        changes: { tags: ['print'] },
      }),
    ])
    // The device shows the "Print …" task at once, due the day before departure.
    expect(await printTasks()).toEqual([
      expect.objectContaining({
        title: 'Ferry voucher',
        titleKey: 'print_document',
        sourceDocumentId: 'doc-1',
        dueOn: '2027-01-19',
        doneAt: null,
        syncState: 'pending',
      }),
    ])
    // Tagging twice keeps the one task.
    await store.update('doc-1', { tags: ['print', 'show_on_phone'] })
    expect(await printTasks()).toHaveLength(1)
  })

  it('removing the print tag deletes the open print task', async () => {
    await db.docs.put(toDocumentRecord(documentRow({ id: 'doc-1', tags: ['print'] })))
    await db.docs.put(toDocumentRecord(documentRow({ id: 'doc-2', tags: ['print'] })))
    await db.tasks.bulkPut([
      taskFixture({ id: 'print-1', origin: 'document', sourceDocumentId: 'doc-1' }),
      taskFixture({
        id: 'print-2',
        origin: 'document',
        sourceDocumentId: 'doc-2',
        doneAt: '2026-11-06T00:00:00.000Z',
      }),
    ])

    await store.update('doc-1', { tags: [] })
    await store.update('doc-2', { tags: [] })

    // The open task goes; a done one is history and stays.
    expect((await printTasks()).map((task) => task.id)).toEqual(['print-2'])
    expect((await mutations()).every((mutation) => mutation?.entity === 'document')).toBe(true)
  })

  it('a link is written through the outbox and works offline', async () => {
    const record = await store.addLink({
      tripId: 'trip-1',
      url: 'https://tickets.example.com/demo',
      title: 'Museum tickets',
      tags: ['show_on_phone'],
      eventId: null,
    })

    expect(await db.docs.get(record.id)).toMatchObject({ kind: 'link', syncState: 'pending' })
    expect(await mutations()).toEqual([
      expect.objectContaining({
        entity: 'document',
        op: 'upsert',
        changes: {
          kind: 'link',
          title: 'Museum tickets',
          url: 'https://tickets.example.com/demo',
          tags: ['show_on_phone'],
          eventId: null,
        },
      }),
    ])
  })

  it('a delete can be undone until its window closes, then it is queued', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await db.docs.put(toDocumentRecord(documentRow({ id: 'doc-1', tags: ['print'] })))
    await db.tasks.put(taskFixture({ id: 'p', origin: 'document', sourceDocumentId: 'doc-1' }))

    const first = await store.removeWithUndo('doc-1', 8000)
    expect(await db.docs.get('doc-1')).toBeUndefined()
    expect(await db.tasks.get('p')).toBeUndefined()
    await first.undo()
    expect(await db.docs.get('doc-1')).toBeDefined()
    expect(await db.tasks.get('p')).toBeDefined()
    expect(await db.outbox.count()).toBe(0)

    await store.removeWithUndo('doc-1', 8000)
    vi.advanceTimersByTime(8000)
    vi.useRealTimers()
    await vi.waitFor(async () =>
      expect(await mutations()).toEqual([
        expect.objectContaining({ entity: 'document', op: 'delete', id: 'doc-1' }),
      ])
    )
  })

  it('documentsNeededToday follows the device copy', async () => {
    await db.events.put(
      toEventRecord(blankEvent({ id: 'ferry', kind: 'ferry', startsOn: '2027-01-21' }))
    )
    await db.docs.bulkPut([
      toDocumentRecord(documentRow({ id: 'voucher', eventId: 'ferry', tags: ['print'] })),
      toDocumentRecord(documentRow({ id: 'plain', eventId: 'ferry', tags: [] })),
    ])
    const needed = TestBed.runInInjectionContext(() =>
      store.documentsNeededToday(signal('trip-1'), signal('2027-01-21'))
    )

    await vi.waitFor(() =>
      expect(needed().map((item) => [item.document.id, item.reasons])).toEqual([
        ['voucher', ['print']],
      ])
    )
  })
})
