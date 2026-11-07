import { Injectable, computed, inject, signal } from '@angular/core'
import { offlineReadiness, type OfflineReadiness, type Platform } from '@monkitrips/shared'
import { CLOCK } from '../../core/offline/clock'
import { DocumentCopiesStore } from '../../core/offline/document-copies.store'
import {
  META_LAST_OFFLINE_BOOT_AT,
  META_LAST_PULL_AT,
  MetaStore,
} from '../../core/offline/meta.store'
import { OfflineReadinessStore } from '../../core/offline/offline-readiness.store'
import { OnlineStore } from '../../core/offline/online.store'
import { OutboxStore } from '../../core/offline/outbox.store'
import { SyncService } from '../../core/offline/sync.service'
import { AppVersionStore } from '../../core/pwa/app-version.store'
import { AssetCache, type CachedAssets } from '../../core/pwa/asset-cache'
import { InstallService } from '../../core/pwa/install.service'
import { StorageProbe, type StorageState } from '../../core/pwa/storage-probe'
import { UpdateService } from '../../core/pwa/update.service'

/** The worker app.config registers (`provideServiceWorker('sw.js')`). */
const SERVICE_WORKER_SCRIPT = 'sw.js'

/** The steps of "Download everything", in order. */
export const DOWNLOAD_STEPS = ['sync', 'version', 'documents', 'storage', 'assets'] as const

export type DownloadStep = (typeof DOWNLOAD_STEPS)[number]

export interface DownloadProgress {
  step: DownloadStep
  done: number
  total: number
}

export type DownloadOutcome =
  | { kind: 'done'; failedDocuments: number }
  | { kind: 'offline' }
  | { kind: 'failed'; step: DownloadStep }

interface DeviceProbe {
  assets: CachedAssets
  storage: StorageState
  /** A service worker serves this page: the cached build is the one running. */
  controlled: boolean
}

/** Reads the platform from the user agent the way the Directions link does. */
function platformOf(ios: boolean, userAgent: string): Platform {
  if (ios) {
    return 'ios'
  }
  if (/Android/i.test(userAgent)) {
    return 'android'
  }
  return /Windows|Macintosh|Linux|CrOS/i.test(userAgent) ? 'desktop' : 'other'
}

/**
 * "Ready to fly" for one trip: gathers the device facts (service worker,
 * Dexie, storage, platform) and lets `offline_readiness` decide the seven
 * checks; runs "Download everything" (pull, every document saved and
 * verified, storage persisted, caches warmed) with its progress, and the
 * fix of each check. Provided by the page, keyed by `tripId`.
 */
@Injectable()
export class ReadyToFlyStore {
  private readonly clock = inject(CLOCK)
  private readonly meta = inject(MetaStore)
  private readonly sync = inject(SyncService)
  private readonly outbox = inject(OutboxStore)
  private readonly copies = inject(DocumentCopiesStore)
  private readonly readinessOf = inject(OfflineReadinessStore)
  private readonly versions = inject(AppVersionStore)
  private readonly updates = inject(UpdateService)
  private readonly assets = inject(AssetCache)
  private readonly storage = inject(StorageProbe)
  private readonly install = inject(InstallService)
  private readonly online = inject(OnlineStore).online

  /** The trip the page shows; the live queries follow it. */
  readonly tripId = signal('')

  /** The trip's files against their saved copies, verified by sha256 (the vault's readiness). */
  private readonly documents = this.readinessOf.documentsFor(this.tripId)
  private readonly lastPullAt = this.meta.watch<string | null>(META_LAST_PULL_AT, null)
  readonly lastOfflineBootAt = this.meta.watch<string | null>(META_LAST_OFFLINE_BOOT_AT, null)
  private readonly probe = signal<DeviceProbe | null>(null)
  private readonly progressState = signal<DownloadProgress | null>(null)

  /** "Download everything" while it runs, null otherwise. */
  readonly progress = this.progressState.asReadonly()
  readonly busy = computed(() => this.progressState() !== null)
  readonly ios = this.install.ios
  readonly installed = this.install.standalone
  readonly updatePending = this.updates.versionReady
  /** Files of the trip the device can keep (links need no copy). */
  readonly savableCount = computed(() => this.documents().total)
  readonly storagePersisted = computed(() => this.probe()?.storage.persisted ?? false)

  /** The seven checks, null until the device has been probed once. */
  readonly readiness = computed<OfflineReadiness | null>(() => {
    const probe = this.probe()
    if (!probe) {
      return null
    }
    const version = this.versions.info()
    return offlineReadiness({
      now: this.clock(),
      app: {
        cachedVersion: probe.controlled && version ? version.version : null,
        updatePending: this.updates.versionReady(),
      },
      snapshotAt: this.lastPullAt(),
      documents: this.documents().states,
      assets: probe.assets,
      storage: probe.storage,
      outboxCount: this.outbox.pendingCount() + this.outbox.failedCount(),
      platform: platformOf(this.install.ios, globalThis.navigator?.userAgent ?? ''),
      installed: this.install.standalone(),
    })
  })

  /** Reads the facts that do not live in Dexie (caches, storage, the worker) again. */
  async refresh(): Promise<void> {
    const [assets, storage] = await Promise.all([this.assets.check(), this.storage.state()])
    this.probe.set({ assets, storage, controlled: this.assets.controlled() })
  }

  /**
   * Everything the trip needs offline, in one go. Needs the network: a
   * step that fails stops the run and says which (the checks then show
   * what is still missing).
   */
  async downloadEverything(): Promise<DownloadOutcome> {
    if (!this.online()) {
      return { kind: 'offline' }
    }
    let total = DOWNLOAD_STEPS.length
    let done = 0
    const at = (step: DownloadStep) => this.progressState.set({ step, done, total })
    let step: DownloadStep = 'sync'
    try {
      at(step)
      await this.sync.pull()
      await this.sync.push()
      done += 1

      step = 'version'
      at(step)
      await this.versions.refresh()
      await this.updates.checkNow()
      done += 1

      step = 'documents'
      at(step)
      // The documents step counts one unit per file to save (at least one).
      const base = done
      const result = await this.copies.saveAll(this.tripId(), (progress) => {
        total = DOWNLOAD_STEPS.length - 1 + Math.max(1, progress.total)
        done = base + progress.done
        at(step)
      })
      const failedDocuments = result.failed.length
      done = base + Math.max(1, result.saved.length + result.failed.length)

      step = 'storage'
      at(step)
      await this.storage.persist()
      done += 1

      step = 'assets'
      at(step)
      if (this.updates.enabled) {
        await this.assets.ensureRegistered(SERVICE_WORKER_SCRIPT)
      }
      await this.assets.warm()
      done += 1
      at(step)
      return { kind: 'done', failedDocuments }
    } catch {
      return { kind: 'failed', step }
    } finally {
      this.progressState.set(null)
      await this.refresh()
    }
  }

  /** Sync now: refreshes the snapshot and sends the outbox. */
  async syncNow(): Promise<void> {
    await this.sync.syncNow().catch(() => undefined)
    await this.refresh()
  }

  async saveDocuments(): Promise<void> {
    await this.copies.saveAll(this.tripId())
    await this.refresh()
  }

  async persistStorage(): Promise<void> {
    await this.storage.persist()
    await this.refresh()
  }

  async warmAssets(): Promise<void> {
    await this.assets.warm()
    await this.refresh()
  }

  /** A waiting version is activated by a reload; otherwise ask the server and the worker again. */
  async fixVersion(): Promise<void> {
    if (this.updates.versionReady()) {
      this.updates.reload()
      return
    }
    await this.versions.refresh()
    await this.updates.checkNow()
    await this.refresh()
  }
}
