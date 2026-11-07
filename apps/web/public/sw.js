/*
 * The app's service worker. Two jobs:
 *   1. Web Share Target: the manifest posts shared files to /share-target.
 *      This handler stores them in the `share-inbox` IndexedDB database and
 *      answers 303 to /share, where the app reads the inbox (WP 2.8).
 *   2. Everything else is Angular's service worker (ngsw-worker.js), imported
 *      below. Our fetch listener registers first and stops propagation for
 *      the share POST, so ngsw never sees it; ngsw ignores POST anyway.
 *
 * Served with no-cache by the API like ngsw-worker.js (static_cache_policy).
 */
const SHARE_TARGET_PATH = '/share-target'
const SHARE_INBOX_PATH = '/share'
const INBOX_DB = 'share-inbox'
const INBOX_STORE = 'items'

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'POST') {
    return
  }
  const url = new URL(request.url)
  if (url.pathname !== SHARE_TARGET_PATH) {
    return
  }
  event.stopImmediatePropagation()
  event.respondWith(
    storeShare(request).then(
      () => redirectTo(SHARE_INBOX_PATH),
      () => redirectTo(SHARE_INBOX_PATH + '?error=store')
    )
  )
})

function redirectTo(path) {
  return Response.redirect(new URL(path, self.location.origin).href, 303)
}

async function storeShare(request) {
  const form = await request.formData()
  const files = form.getAll('files').filter((entry) => typeof entry === 'object' && entry !== null)
  const receivedAt = new Date().toISOString()
  const items = files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: file.size,
    blob: file,
    title: form.get('title'),
    text: form.get('text'),
    url: form.get('url'),
    receivedAt,
  }))
  if (items.length === 0) {
    items.push({
      id: crypto.randomUUID(),
      name: null,
      type: null,
      size: 0,
      blob: null,
      title: form.get('title'),
      text: form.get('text'),
      url: form.get('url'),
      receivedAt,
    })
  }
  const db = await openInbox()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(INBOX_STORE, 'readwrite')
    const store = tx.objectStore(INBOX_STORE)
    for (const item of items) {
      store.put(item)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

function openInbox() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(INBOX_DB, 1)
    open.onupgradeneeded = () => {
      open.result.createObjectStore(INBOX_STORE, { keyPath: 'id' })
    }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
}

importScripts('ngsw-worker.js')
