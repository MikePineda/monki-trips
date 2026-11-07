import { Injectable, Injector, computed, inject, signal } from '@angular/core'
import { DOCUMENTS_API } from '../api/documents-api'
import { storagePressure, type StoragePressure } from '../../domain/storage-warning'
import { CLOCK } from './clock'
import { DEVICE_STORAGE, type StorageEstimateBytes } from './device-storage'
import { liveSignal } from './live'
import { MetaStore } from './meta.store'
import { OFFLINE_DB } from './offline-db'
import type { DocBlobRecord, DocRecord } from './records'
import { sha256Hex } from './sha256'

/** Set once `navigator.storage.persist()` has been asked, so it is asked only the first time. */
export const META_PERSIST_REQUESTED = 'storage.persistRequested'

/** What the device knows about one saved copy (never the bytes). */
export interface CopyInfo {
  docId: string
  sha256: string
  size: number
}

export interface SaveResult {
  /** True when the copy's sha256 equals the server's. */
  verified: boolean
  sha256: string
}

export interface StorageStatus extends StoragePressure {
  persisted: boolean
  estimate: StorageEstimateBytes | null
  /** Bytes the saved copies take. */
  copiesBytes: number
}

/**
 * Offline copies of document files, in Dexie `docBlobs` (not Cache
 * Storage, so the hash can be checked): "Save offline" fetches the bytes
 * through the short signed URL, hashes them and keeps blob + sha256; the
 * list compares that hash with the server's. The first save asks the
 * browser to persist the origin's storage.
 */
@Injectable({ providedIn: 'root' })
export class DocumentCopiesStore {
  private readonly database = inject(OFFLINE_DB)
  private readonly api = inject(DOCUMENTS_API)
  private readonly storage = inject(DEVICE_STORAGE)
  private readonly meta = inject(MetaStore)
  private readonly clock = inject(CLOCK)
  private readonly injector = inject(Injector)
  private readonly inFlight = signal<ReadonlySet<string>>(new Set())

  /** Every saved copy, by document id. */
  readonly copies = liveSignal<ReadonlyMap<string, CopyInfo>>(
    async (db) => {
      const map = new Map<string, CopyInfo>()
      await db.docBlobs.each((copy) => {
        map.set(copy.docId, { docId: copy.docId, sha256: copy.sha256, size: copy.size })
      })
      return map
    },
    new Map(),
    { injector: this.injector }
  )

  /** Documents whose bytes are on their way. */
  readonly saving = this.inFlight.asReadonly()

  readonly copiesBytes = computed(() =>
    [...this.copies().values()].reduce((sum, copy) => sum + copy.size, 0)
  )

  /** Fetches the file, stores it with its hash and says whether the hash matches the server's. */
  async save(document: Pick<DocRecord, 'id' | 'tripId' | 'mime' | 'sha256'>): Promise<SaveResult> {
    this.inFlight.update((ids) => new Set([...ids, document.id]))
    try {
      const blob = await this.api.download(document.tripId, document.id)
      const sha256 = await sha256Hex(blob)
      const db = await this.database
      await db.docBlobs.put({
        docId: document.id,
        sha256,
        size: blob.size,
        mime: blob.type || document.mime || 'application/octet-stream',
        blob,
        savedAt: this.clock(),
      })
      await this.requestPersistOnce()
      return { verified: document.sha256 !== null && sha256 === document.sha256, sha256 }
    } finally {
      this.inFlight.update((ids) => new Set([...ids].filter((id) => id !== document.id)))
    }
  }

  /**
   * The bytes to show or share: the saved copy when there is one (works
   * offline), else a fresh download that is not kept.
   */
  async open(document: Pick<DocRecord, 'id' | 'tripId'>): Promise<Blob> {
    const copy = await this.get(document.id)
    return copy ? copy.blob : this.api.download(document.tripId, document.id)
  }

  async remove(docId: string): Promise<void> {
    const db = await this.database
    await db.docBlobs.delete(docId)
  }

  /** The saved copy, bytes included, or undefined. */
  async get(docId: string): Promise<DocBlobRecord | undefined> {
    const db = await this.database
    return db.docBlobs.get(docId)
  }

  /** Quota, usage and whether the copies (plus `incomingBytes`) take more than half of what is free. */
  async status(incomingBytes = 0): Promise<StorageStatus> {
    const [estimate, persisted] = await Promise.all([
      this.storage.estimate(),
      this.storage.persisted(),
    ])
    const copiesBytes = this.copiesBytes()
    return {
      ...storagePressure(estimate, copiesBytes + incomingBytes),
      persisted,
      estimate,
      copiesBytes,
    }
  }

  private async requestPersistOnce(): Promise<void> {
    if (await this.meta.get<boolean>(META_PERSIST_REQUESTED)) {
      return
    }
    await this.meta.set(META_PERSIST_REQUESTED, true)
    await this.storage.persist()
  }
}
