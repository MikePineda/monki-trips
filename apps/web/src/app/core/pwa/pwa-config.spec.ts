import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guards the static PWA configuration: the manifest that makes the app
 * installable, the service-worker config that must never cache API data and
 * the custom sw.js that fronts Angular's worker for the Share Target.
 */
const webRoot = process.cwd()
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(webRoot, path), 'utf8')) as T

interface Manifest {
  name: string
  id: string
  display: string
  orientation: string
  start_url: string
  theme_color: string
  background_color: string
  icons: { src: string; sizes: string; purpose?: string }[]
  shortcuts: { name: string; url: string }[]
  share_target: {
    action: string
    method: string
    enctype: string
    params: { files: { name: string; accept: string[] }[] }
  }
}

interface NgswConfig {
  navigationUrls: string[]
  assetGroups: { name: string; installMode: string; resources: { files: string[] } }[]
  dataGroups?: { urls: string[] }[]
}

describe('web app manifest', () => {
  const manifest = readJson<Manifest>('public/manifest.webmanifest')

  it('installs as monki trips, standalone and portrait, opening the trip list', () => {
    expect(manifest.name).toBe('monki trips')
    expect(manifest.id).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.orientation).toBe('portrait')
    expect(manifest.start_url).toBe('/trips')
  })

  it('manifest colours match the light page surface token', () => {
    const styles = readFileSync(join(webRoot, 'src/styles.css'), 'utf8')
    const surface0 = /--surface-0:\s*(#[0-9a-f]{6});/.exec(styles)?.[1]

    expect(surface0).toBeDefined()
    expect(manifest.theme_color).toBe(surface0)
    expect(manifest.background_color).toBe(surface0)
  })

  it('ships any and maskable icons that exist on disk', () => {
    const purposes = manifest.icons.map((icon) => icon.purpose ?? 'any')

    expect(purposes).toContain('any')
    expect(purposes).toContain('maskable')
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true)
    for (const icon of manifest.icons) {
      expect(existsSync(join(webRoot, 'public', icon.src)), icon.src).toBe(true)
    }
  })

  it('offers the "Add expense" shortcut on the active trip', () => {
    expect(manifest.shortcuts).toEqual([
      expect.objectContaining({ name: 'Add expense', url: '/t/current/add' }),
    ])
  })

  it('accepts shared PDFs and images by multipart POST to /share-target', () => {
    expect(manifest.share_target.action).toBe('/share-target')
    expect(manifest.share_target.method).toBe('POST')
    expect(manifest.share_target.enctype).toBe('multipart/form-data')
    expect(manifest.share_target.params.files).toEqual([
      { name: 'files', accept: ['application/pdf', 'image/*'] },
    ])
  })
})

describe('service worker config', () => {
  const config = readJson<NgswConfig>('ngsw-config.json')
  const app = config.assetGroups.find((group) => group.name === 'app')

  it('never caches api responses', () => {
    expect(config.dataGroups ?? []).toEqual([])
  })

  it('api urls and the share target are never served the app shell', () => {
    expect(config.navigationUrls).toContain('!/api/**')
    expect(config.navigationUrls).toContain('!/share-target')
  })

  it('prefetches every script, so the lazy pdf.js renderer and its worker open a quick view offline', () => {
    expect(app?.resources.files).toContain('/*.js')
    expect(app?.resources.files).toContain('!/sw.js')
  })

  it('prefetches the shell, the manifest, the catalogues, the sprite, fonts and the mascot', () => {
    expect(app?.installMode).toBe('prefetch')
    expect(app?.resources.files).toEqual(
      expect.arrayContaining([
        '/index.html',
        '/manifest.webmanifest',
        '/i18n/*.json',
        '/*.js',
        '/sprite/*.svg',
        '/fonts/**',
        '/mascot/**',
      ])
    )
  })

  it('leaves sw.js out of the hashed assets so the browser always fetches it', () => {
    expect(app?.resources.files).toContain('!/sw.js')
  })
})

describe('custom service worker (public/sw.js)', () => {
  const source = readFileSync(join(webRoot, 'public/sw.js'), 'utf8')

  it("is the registered worker and imports Angular's worker last", () => {
    const config = readFileSync(join(webRoot, 'src/app/app.config.ts'), 'utf8')

    expect(config).toContain("provideServiceWorker('sw.js'")
    expect(source.trimEnd().endsWith("importScripts('ngsw-worker.js')")).toBe(true)
  })

  it('stores a share POST in the share-inbox database and answers 303 to /share', () => {
    expect(source).toContain("const SHARE_TARGET_PATH = '/share-target'")
    expect(source).toContain("const INBOX_DB = 'share-inbox'")
    expect(source).toContain("request.method !== 'POST'")
    expect(source).toContain('event.stopImmediatePropagation()')
    expect(source).toContain("const SHARE_INBOX_PATH = '/share'")
    expect(source).toContain('303')
  })

  it('shows a push message as a notification and opens its url on tap, ahead of ngsw', () => {
    const pushHandler = source.indexOf("addEventListener('push'")
    const clickHandler = source.indexOf("addEventListener('notificationclick'")
    const ngsw = source.indexOf("importScripts('ngsw-worker.js')")

    expect(pushHandler).toBeGreaterThan(-1)
    expect(clickHandler).toBeGreaterThan(-1)
    expect(pushHandler).toBeLessThan(ngsw)
    expect(clickHandler).toBeLessThan(ngsw)
    expect(source).toContain('self.registration.showNotification(payload.title')
    expect(source).toContain('data: { url: payload.url }')
    expect(source).toContain('self.clients.openWindow(url)')
    // Only the app's own origin is ever opened from a notification.
    expect(source).toContain('target.origin !== self.location.origin')
  })
})

describe('notification tap (public/sw.js notificationclick)', () => {
  const source = readFileSync(join(webRoot, 'public/sw.js'), 'utf8')
  const ORIGIN = 'https://trips.example.com'

  interface FakeWindowClient {
    url: string
    focus(): Promise<FakeWindowClient>
    navigate(url: string): Promise<FakeWindowClient>
  }

  /** Runs sw.js against a fake `self` and taps a notification whose data carries `data`. */
  async function tap(data: unknown, openWindows: string[] = []) {
    const calls: string[] = []
    const windows: FakeWindowClient[] = openWindows.map((url) => {
      const client: FakeWindowClient = {
        url,
        focus: async () => {
          calls.push(`focus ${url}`)
          return client
        },
        navigate: async (target) => {
          calls.push(`navigate ${target}`)
          return client
        },
      }
      return client
    })
    const listeners = new Map<string, (event: unknown) => void>()
    const self = {
      location: { origin: ORIGIN },
      registration: {},
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        listeners.set(type, listener),
      clients: {
        matchAll: async () => windows,
        openWindow: async (url: string) => {
          calls.push(`open ${url}`)
          return null
        },
      },
    }
    // The worker is a classic script: evaluate it with our `self` and a no-op importScripts.
    new Function('self', 'importScripts', source)(self, () => undefined)
    let pending: Promise<unknown> = Promise.resolve()
    listeners.get('notificationclick')!({
      stopImmediatePropagation: () => undefined,
      notification: { data, close: () => calls.push('close') },
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise
      },
    })
    await pending
    return calls
  }

  it('navigates an open app window to the reminder url and focuses it', async () => {
    expect(await tap({ url: '/t/trip-1/plan/e/event-1' }, [`${ORIGIN}/trips`])).toEqual([
      'close',
      `focus ${ORIGIN}/trips`,
      `navigate ${ORIGIN}/t/trip-1/plan/e/event-1`,
    ])
  })

  it('opens a new window on the url when no app window is open', async () => {
    expect(await tap({ url: '/t/trip-1/today' })).toEqual([
      'close',
      `open ${ORIGIN}/t/trip-1/today`,
    ])
  })

  it('ignores windows of other origins', async () => {
    expect(await tap({ url: '/t/trip-1/more/tasks' }, ['https://other.example.org/'])).toEqual([
      'close',
      `open ${ORIGIN}/t/trip-1/more/tasks`,
    ])
  })

  it('a url that is not a path of this origin opens the app root instead', async () => {
    for (const url of [
      'https://other.example.org/t/trip-1/today',
      '//other.example.org/t/trip-1/today',
      '/\\other.example.org/t',
      'javascript:alert(1)',
    ]) {
      expect(await tap({ url })).toEqual(['close', `open ${ORIGIN}/`])
    }
  })

  it('a notification without a url opens the app root', async () => {
    expect(await tap(undefined)).toEqual(['close', `open ${ORIGIN}/`])
    expect(await tap({ url: 42 })).toEqual(['close', `open ${ORIGIN}/`])
  })
})
