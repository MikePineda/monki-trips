/*
 * The app's service worker. Three jobs:
 *   1. Web Share Target: the manifest posts shared files to /share-target.
 *      This handler stores them in the `share-inbox` IndexedDB database and
 *      answers 303 to /share, where the app reads the inbox (WP 2.8).
 *   2. Web Push: a message carries the API's PushPayload JSON
 *      ({ title, body, url, tag }); `push` shows it as a notification and
 *      `notificationclick` focuses an open window of the app (or opens one)
 *      on `url`. ngsw expects its own `{ notification }` shape, so both
 *      listeners stop propagation and ngsw never sees these events.
 *   3. Everything else is Angular's service worker (ngsw-worker.js), imported
 *      below. Our listeners register first and stop propagation for what
 *      they handle, so ngsw never sees it; ngsw ignores POST anyway.
 *
 * Served with no-cache by the API like ngsw-worker.js (static_cache_policy).
 */
const SHARE_TARGET_PATH = '/share-target'
const SHARE_INBOX_PATH = '/share'
const INBOX_DB = 'share-inbox'
const INBOX_STORE = 'items'
const NOTIFICATION_ICON = '/icons/icon-192.png'
const NOTIFICATION_BADGE = '/icons/icon-maskable-192.png'

self.addEventListener('push', (event) => {
  event.stopImmediatePropagation()
  const payload = readPushPayload(event)
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      data: { url: payload.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation()
  event.notification.close()
  const target = new URL(
    (event.notification.data && event.notification.data.url) || '/',
    self.location.origin
  )
  if (target.origin !== self.location.origin) {
    return
  }
  event.waitUntil(focusOrOpen(target.href))
})

/** The PushPayload of the message; a message without one (or with bad JSON) still shows something honest. */
function readPushPayload(event) {
  const fallback = { title: 'monki trips', body: '', url: '/', tag: 'message' }
  if (!event.data) {
    return fallback
  }
  try {
    const data = event.data.json()
    return {
      title: typeof data.title === 'string' && data.title ? data.title : fallback.title,
      body: typeof data.body === 'string' ? data.body : fallback.body,
      url: typeof data.url === 'string' && data.url ? data.url : fallback.url,
      tag: typeof data.tag === 'string' && data.tag ? data.tag : fallback.tag,
    }
  } catch {
    return { ...fallback, body: event.data.text() }
  }
}

/** Brings an open window of the app to `url` (focus, then navigate) or opens a new one. */
async function focusOrOpen(url) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
  if (existing) {
    const focused = 'focus' in existing ? await existing.focus() : existing
    if ('navigate' in focused) {
      try {
        await focused.navigate(url)
        return
      } catch {
        // An uncontrolled client cannot be navigated: fall through to a new window.
      }
    } else {
      return
    }
  }
  await self.clients.openWindow(url)
}

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
