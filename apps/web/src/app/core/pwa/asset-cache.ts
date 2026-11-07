import { DOCUMENT, Injectable, InjectionToken, inject } from '@angular/core'
import { ACTIVE_MASCOT, mascotSheetUrl } from '../../shared/ui/mascot/mascot-sheet'

/** The browser's Cache Storage, or null where there is none (no service worker support). */
export const CACHE_STORAGE = new InjectionToken<CacheStorage | null>('CACHE_STORAGE', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).defaultView?.caches ?? null,
})

/** The service worker container, or null where the browser has none. */
export const SERVICE_WORKER_CONTAINER = new InjectionToken<ServiceWorkerContainer | null>(
  'SERVICE_WORKER_CONTAINER',
  {
    providedIn: 'root',
    factory: () => inject(DOCUMENT).defaultView?.navigator.serviceWorker ?? null,
  }
)

/** Both language catalogues: the scope catalogues travel inside the prefetched bundles. */
export const LOCALE_ASSETS = ['i18n/en.json', 'i18n/es.json'] as const

/** The active mascot: its choice and its sprite sheet. */
export const MASCOT_ASSETS = ['mascot/active.json', mascotSheetUrl(ACTIVE_MASCOT)] as const

export interface CachedAssets {
  locales: boolean
  mascot: boolean
}

/** How long "Download everything" waits for the service worker to take the page. */
const CONTROL_TIMEOUT_MS = 15_000

/**
 * What the service worker holds for a flight: both language catalogues and
 * the mascot, checked in Cache Storage (where ngsw keeps its asset groups),
 * and a warm-up that waits for the worker to control the page and fetches
 * them through it, so a cold start with no network finds them.
 */
@Injectable({ providedIn: 'root' })
export class AssetCache {
  private readonly caches = inject(CACHE_STORAGE)
  private readonly worker = inject(SERVICE_WORKER_CONTAINER)
  private readonly document = inject(DOCUMENT)

  /** True when a service worker controls this page (its cached version is what runs). */
  controlled(): boolean {
    return this.worker?.controller != null
  }

  async check(): Promise<CachedAssets> {
    return {
      locales: await this.allCached(LOCALE_ASSETS),
      mascot: await this.allCached(MASCOT_ASSETS),
    }
  }

  /**
   * Registers the app's worker now instead of waiting for Angular's
   * delayed registration (`registerWhenStable`), so "Download everything"
   * does not race it. Registering the same script again is a no-op.
   */
  async ensureRegistered(script: string): Promise<void> {
    const worker = this.worker
    if (!worker || (await worker.getRegistration().catch(() => undefined))) {
      return
    }
    await worker.register(script).catch(() => undefined)
  }

  /** Waits for the worker, then fetches every asset through it. Resolves with what is cached after. */
  async warm(): Promise<CachedAssets> {
    await this.untilControlled()
    const fetcher = this.document.defaultView?.fetch.bind(this.document.defaultView)
    if (fetcher) {
      await Promise.all(
        [...LOCALE_ASSETS, ...MASCOT_ASSETS].map((path) =>
          fetcher(this.url(path)).catch(() => undefined)
        )
      )
    }
    return this.check()
  }

  private async untilControlled(): Promise<void> {
    const worker = this.worker
    if (!worker || worker.controller) {
      return
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, CONTROL_TIMEOUT_MS)
      function done() {
        clearTimeout(timer)
        worker?.removeEventListener('controllerchange', done)
        resolve()
      }
      worker.addEventListener('controllerchange', done)
      void worker.ready.then(() => {
        if (worker.controller) {
          done()
        }
      })
    })
  }

  private async allCached(paths: readonly string[]): Promise<boolean> {
    const storage = this.caches
    if (!storage) {
      return false
    }
    for (const path of paths) {
      if (!(await storage.match(this.url(path)).catch(() => undefined))) {
        return false
      }
    }
    return true
  }

  private url(path: string): string {
    return new URL(path, this.document.baseURI).href
  }
}
