import { Injectable, inject } from '@angular/core'
import { HEALTH_API } from '../api/health-api'
import { CLOCK } from '../offline/clock'
import { META_APP_VERSION, MetaStore } from '../offline/meta.store'

/** The server build as last seen, kept in Dexie meta so Settings shows it offline. */
export interface AppVersionInfo {
  version: string
  sha: string
  /** ISO timestamp of the probe. */
  fetchedAt: string
}

@Injectable({ providedIn: 'root' })
export class AppVersionStore {
  private readonly api = inject(HEALTH_API)
  private readonly meta = inject(MetaStore)
  private readonly clock = inject(CLOCK)

  /** The cached build info; null until the first successful probe. */
  readonly info = this.meta.watch<AppVersionInfo | null>(META_APP_VERSION, null)

  /** Probes `/api/health` and caches version and sha. Network errors leave the cache alone. */
  async refresh(): Promise<AppVersionInfo | null> {
    try {
      const report = await this.api.health()
      const info: AppVersionInfo = {
        version: report.version,
        sha: report.sha,
        fetchedAt: this.clock(),
      }
      await this.meta.set(META_APP_VERSION, info)
      return info
    } catch {
      return (await this.meta.get<AppVersionInfo>(META_APP_VERSION)) ?? null
    }
  }
}
