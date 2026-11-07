import { IDBFactory } from 'fake-indexeddb'
import { IndexedDbShareInbox, SHARE_INBOX_DB, SHARE_INBOX_STORE } from './share-inbox'

/** Writes items the way public/sw.js does. */
async function seed(factory: IDBFactory, items: object[]): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(SHARE_INBOX_DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(SHARE_INBOX_STORE, { keyPath: 'id' })
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SHARE_INBOX_STORE, 'readwrite')
    for (const item of items) tx.objectStore(SHARE_INBOX_STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

describe('IndexedDbShareInbox', () => {
  const item = (id: string, receivedAt: string) => ({
    id,
    name: `${id}.pdf`,
    type: 'application/pdf',
    size: 3,
    blob: null,
    title: null,
    text: null,
    url: null,
    receivedAt,
  })

  it('lists what the service worker stored, oldest first, and removes an item', async () => {
    const factory = new IDBFactory()
    await seed(factory, [item('b', '2026-11-07T12:00:00Z'), item('a', '2026-11-07T11:00:00Z')])
    const inbox = new IndexedDbShareInbox(() => factory)

    expect((await inbox.list()).map((entry) => entry.id)).toEqual(['a', 'b'])
    await inbox.remove('a')
    expect((await inbox.list()).map((entry) => entry.id)).toEqual(['b'])
  })

  it('an empty inbox (never written) lists nothing', async () => {
    expect(await new IndexedDbShareInbox(() => new IDBFactory()).list()).toEqual([])
    expect(await new IndexedDbShareInbox(() => null).list()).toEqual([])
  })
})
