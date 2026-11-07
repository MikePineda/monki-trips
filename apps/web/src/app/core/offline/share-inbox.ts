import { DOCUMENT, inject, InjectionToken } from '@angular/core'

/** The database and store `public/sw.js` writes shared files into. */
export const SHARE_INBOX_DB = 'share-inbox'
export const SHARE_INBOX_STORE = 'items'

/**
 * One thing another app shared with monki trips (Web Share Target), as
 * the service worker stored it: a file with its name, type and bytes, or
 * only the shared title, text and url when no file came along.
 */
export interface SharedItem {
  id: string
  name: string | null
  type: string | null
  size: number
  blob: Blob | null
  title: string | null
  text: string | null
  url: string | null
  /** ISO instant. */
  receivedAt: string
}

/** The inbox the share target fills; the `/share` page empties it. */
export interface ShareInbox {
  /** Items oldest first. */
  list(): Promise<SharedItem[]>
  remove(id: string): Promise<void>
}

export const SHARE_INBOX = new InjectionToken<ShareInbox>('SHARE_INBOX', {
  providedIn: 'root',
  factory: () => {
    const indexedDB = inject(DOCUMENT).defaultView?.indexedDB
    return new IndexedDbShareInbox(() => indexedDB ?? null)
  },
})

/**
 * `ShareInbox` over the raw IndexedDB database of the service worker (not
 * Dexie: the worker owns its schema and writes it without the app).
 */
export class IndexedDbShareInbox implements ShareInbox {
  constructor(private readonly factory: () => IDBFactory | null) {}

  async list(): Promise<SharedItem[]> {
    const db = await this.open()
    if (!db) {
      return []
    }
    try {
      const items = await request<SharedItem[]>(
        db.transaction(SHARE_INBOX_STORE, 'readonly').objectStore(SHARE_INBOX_STORE).getAll()
      )
      return [...items].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    } finally {
      db.close()
    }
  }

  async remove(id: string): Promise<void> {
    const db = await this.open()
    if (!db) {
      return
    }
    try {
      await request(
        db.transaction(SHARE_INBOX_STORE, 'readwrite').objectStore(SHARE_INBOX_STORE).delete(id)
      )
    } finally {
      db.close()
    }
  }

  private async open(): Promise<IDBDatabase | null> {
    const factory = this.factory()
    if (!factory) {
      return null
    }
    const open = factory.open(SHARE_INBOX_DB, 1)
    open.onupgradeneeded = () => {
      open.result.createObjectStore(SHARE_INBOX_STORE, { keyPath: 'id' })
    }
    return request(open)
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
