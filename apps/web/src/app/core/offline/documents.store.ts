import { Injectable, Injector, computed, inject, type Signal } from '@angular/core'
import {
  PRINT_TASK_TITLE_KEY,
  reconcilePrintTask,
  type DocumentTag,
  type EventKind,
} from '@monkitrips/shared'
import { v7 as uuidv7 } from 'uuid'
import { DOCUMENTS_API } from '../api/documents-api'
import { checkUploadFile, type UploadRejection } from '../../domain/document-upload-check'
import { documentsNeededToday, type NeededDocument } from '../../domain/documents-needed-today'
import { localToday } from '../../domain/local-today'
import { CLOCK } from './clock'
import type { MonkiTripsDb } from './db'
import { toDocumentRecord } from './document-record'
import { liveSignal } from './live'
import { OFFLINE_DB } from './offline-db'
import { OutboxStore } from './outbox.store'
import type { DocBlobRecord, DocRecord, TaskRecord } from './records'
import { SyncService } from './sync.service'
import { TIME_ZONE } from './time-zone'

/** A file the person picked, before it leaves the device. */
export interface NewFileDocument {
  tripId: string
  file: Blob
  fileName: string
  title: string
  tags: readonly DocumentTag[]
  eventId: string | null
}

export interface NewLinkDocument {
  tripId: string
  url: string
  title: string
  tags: readonly DocumentTag[]
  eventId: string | null
}

/** What a person may change on a document; the rest is the server's. */
export type DocumentChanges = Partial<Pick<DocRecord, 'title' | 'tags' | 'eventId'>>

/** The client refused a file before sending it (size or type). */
export class DocumentRejected extends Error {
  constructor(readonly reason: UploadRejection) {
    super(`Document rejected on the device: ${reason}`)
    this.name = 'DocumentRejected'
  }
}

export interface DeferredDocumentDelete {
  /** Puts the document back; a no-op once its delete has been queued. */
  undo(): Promise<void>
}

/**
 * The trip's documents on this device. A file is uploaded first (it needs
 * the network: the server hashes and stores the bytes), then lives in
 * `docs` like any synced row; links and every metadata change (title,
 * tags, event) go through the outbox, so they work offline. Tagging a
 * document `print` runs the shared print-task rule on the device: the
 * "Print …" task appears (or its open copy goes) at once, as an
 * optimistic row that is never pushed, because the server makes the real
 * one from the document mutation; the sync service swaps them on pull.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly api = inject(DOCUMENTS_API)
  private readonly outbox = inject(OutboxStore)
  private readonly sync = inject(SyncService)
  private readonly clock = inject(CLOCK)
  private readonly timeZone = inject(TIME_ZONE)
  private readonly injector = inject(Injector)

  /** Every document on the device, all trips. */
  readonly all = liveSignal<DocRecord[]>((db) => db.docs.toArray(), [], {
    injector: this.injector,
  })

  private readonly events = liveSignal<
    { id: string; tripId: string; startsOn: string | null; kind: EventKind }[]
  >(
    async (db) =>
      (await db.events.toArray()).map(({ id, tripId, startsOn, kind }) => ({
        id,
        tripId,
        startsOn,
        kind,
      })),
    [],
    { injector: this.injector }
  )

  forTrip(tripId: Signal<string>): Signal<DocRecord[]> {
    return computed(() => this.all().filter((document) => document.tripId === tripId()))
  }

  /**
   * The documents Today shows (WP 2.4) for a trip and a local date: tagged
   * `print` or `show_on_phone` with an event starting that day, and the
   * passport ones on a flight day, each with its reasons.
   */
  documentsNeededToday(
    tripId: Signal<string>,
    today: Signal<string>
  ): Signal<NeededDocument<DocRecord>[]> {
    return computed(() =>
      documentsNeededToday(
        this.all().filter((document) => document.tripId === tripId()),
        this.events().filter((event) => event.tripId === tripId()),
        today()
      )
    )
  }

  /** Uploads a file (network required) and keeps the server's row. */
  async uploadFile(input: NewFileDocument): Promise<DocRecord> {
    const check = checkUploadFile({
      size: input.file.size,
      type: input.file.type,
      name: input.fileName,
    })
    if (!check.ok) {
      throw new DocumentRejected(check.reason)
    }
    const row = await this.api.upload({
      tripId: input.tripId,
      id: uuidv7(),
      file: input.file,
      fileName: input.fileName,
      title: input.title.trim(),
      tags: input.tags,
      eventId: input.eventId,
    })
    const record = toDocumentRecord(row)
    const db = await this.database
    await db.transaction('rw', [db.docs, db.tasks, db.trips], async () => {
      await db.docs.put(record)
      await this.reconcilePrint(db, record)
    })
    // The server made the print task with the upload: fetch it.
    this.sync.requestSync()
    return record
  }

  /** Adds a link document through the outbox (works offline). */
  async addLink(input: NewLinkDocument): Promise<DocRecord> {
    const now = this.clock()
    const record: DocRecord = {
      id: uuidv7(),
      tripId: input.tripId,
      eventId: input.eventId,
      kind: 'link',
      title: input.title.trim(),
      url: input.url.trim(),
      mime: null,
      sizeBytes: null,
      sha256: null,
      tags: [...input.tags],
      availableOffline: false,
      uploadedBy: null,
      updatedAt: now,
      syncState: 'pending',
    }
    const db = await this.database
    await db.transaction('rw', [db.docs, db.tasks, db.trips, db.outbox], async () => {
      await db.docs.put(record)
      await this.outbox.enqueueMutation(db, record.tripId, {
        entity: 'document',
        op: 'upsert',
        id: record.id,
        changes: {
          kind: 'link',
          title: record.title,
          url: record.url,
          tags: record.tags,
          eventId: record.eventId,
        },
        changedAt: now,
      })
      await this.reconcilePrint(db, record)
    })
    this.sync.requestPush()
    return record
  }

  /** Changes the title, tags or event of a document (optimistic, offline-capable). */
  async update(id: string, changes: DocumentChanges): Promise<void> {
    const now = this.clock()
    const db = await this.database
    await db.transaction('rw', [db.docs, db.tasks, db.trips, db.outbox], async () => {
      const document = await db.docs.get(id)
      if (!document) {
        throw new Error(`Document not found on this device: ${id}`)
      }
      const next: DocRecord = { ...document, ...changes, updatedAt: now, syncState: 'pending' }
      await db.docs.put(next)
      await this.outbox.enqueueMutation(db, document.tripId, {
        entity: 'document',
        op: 'upsert',
        id,
        changes: { ...changes },
        changedAt: now,
      })
      await this.reconcilePrint(db, next)
    })
    this.sync.requestPush()
  }

  /**
   * Removes the document, its offline copy and its open print task at once,
   * and queues the delete only after `windowMs` so "Undo" can put them back
   * (a tombstone always wins on the server).
   */
  async removeWithUndo(id: string, windowMs: number): Promise<DeferredDocumentDelete> {
    const db = await this.database
    const tables = [db.docs, db.docBlobs, db.tasks]
    let document: DocRecord | undefined
    let copy: DocBlobRecord | undefined
    let tasks: TaskRecord[] = []
    await db.transaction('rw', tables, async () => {
      document = await db.docs.get(id)
      copy = await db.docBlobs.get(id)
      tasks = (
        await db.tasks
          .where('tripId')
          .equals(document?.tripId ?? '')
          .toArray()
      ).filter((task) => task.origin === 'document' && task.sourceDocumentId === id && !task.doneAt)
      await db.docs.delete(id)
      await db.docBlobs.delete(id)
      await db.tasks.bulkDelete(tasks.map((task) => task.id))
    })
    const removed = document
    if (!removed) {
      return { undo: async () => undefined }
    }
    let queued = false
    const timer = setTimeout(() => {
      queued = true
      void this.queueDelete(removed)
    }, windowMs)
    return {
      undo: async () => {
        if (queued) {
          return
        }
        queued = true
        clearTimeout(timer)
        await db.transaction('rw', tables, async () => {
          await db.docs.put(removed)
          if (copy) {
            await db.docBlobs.put(copy)
          }
          await db.tasks.bulkPut(tasks)
        })
      },
    }
  }

  private async queueDelete(document: DocRecord): Promise<void> {
    const db = await this.database
    await db.transaction('rw', [db.outbox], () =>
      this.outbox.enqueueMutation(db, document.tripId, {
        entity: 'document',
        op: 'delete',
        id: document.id,
        changes: {},
        changedAt: this.clock(),
      })
    )
    this.sync.requestPush()
  }

  /** The shared print-task rule, applied to the device's tasks (never pushed: the server owns them). */
  private async reconcilePrint(db: MonkiTripsDb, document: DocRecord): Promise<void> {
    const trip = await db.trips.get(document.tripId)
    if (!trip) {
      return
    }
    const now = this.clock()
    const tasks = await db.tasks.where('tripId').equals(document.tripId).toArray()
    const result = reconcilePrintTask({
      document: { ...document, deletedAt: null },
      tasks,
      tripStartsOn: trip.startDate,
      today: localToday(now, this.timeZone),
    })
    if (result.create) {
      const task: TaskRecord = {
        id: uuidv7(),
        tripId: document.tripId,
        eventId: result.create.eventId,
        title: result.create.title,
        titleKey: PRINT_TASK_TITLE_KEY,
        notes: null,
        dueOn: result.create.dueOn,
        priority: result.create.priority,
        doneAt: null,
        doneBy: null,
        origin: 'document',
        sourceDocumentId: document.id,
        templateItemKey: null,
        updatedAt: now,
        syncState: 'pending',
      }
      await db.tasks.put(task)
    }
    if (result.deleteTaskIds.length > 0) {
      await db.tasks.bulkDelete(result.deleteTaskIds)
    }
  }
}
