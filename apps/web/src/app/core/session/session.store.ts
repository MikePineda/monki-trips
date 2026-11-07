import { Injectable, computed, inject, signal } from '@angular/core'
import { META_SESSION, MetaStore } from '../offline/meta.store'
import { OnlineStore } from '../offline/online.store'
import { SESSION_API, type SessionUser } from './session-api'

export type SessionState = 'unknown' | 'anonymous' | 'signed-in'

/**
 * Who is signed in. The answer is cached in Dexie (`meta.session`) so the
 * app boots without network and is never kicked to /login while offline;
 * with network, `/me` refreshes it and a 401 clears it.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(SESSION_API)
  private readonly meta = inject(MetaStore)
  private readonly onlineStore = inject(OnlineStore)
  private readonly current = signal<SessionUser | null>(null)
  private readonly phase = signal<SessionState>('unknown')
  private restoring: Promise<SessionUser | null> | null = null

  readonly user = this.current.asReadonly()
  readonly state = this.phase.asReadonly()
  readonly signedIn = computed(() => this.phase() === 'signed-in')

  /**
   * The cached session, refreshed from the network when possible. Cached
   * user: answer at once and refresh in the background. No cache: ask the
   * server when online, otherwise stay anonymous for now. Runs once; later
   * calls share the result.
   */
  restore(): Promise<SessionUser | null> {
    this.restoring ??= this.restoreOnce()
    return this.restoring
  }

  /** `/me` now: updates the cache, or clears it on 401. Network errors keep the cache. */
  async refresh(): Promise<SessionUser | null> {
    const user = await this.api.me()
    if (user) {
      await this.meta.set(META_SESSION, user)
      this.current.set(user)
      this.phase.set('signed-in')
    } else {
      await this.clear()
    }
    return user
  }

  /** Forgets the session locally (the server call arrives with WP 0.6b). */
  async signOut(): Promise<void> {
    await this.clear()
  }

  private async restoreOnce(): Promise<SessionUser | null> {
    const cached = await this.meta.get<SessionUser>(META_SESSION)
    if (cached) {
      this.current.set(cached)
      this.phase.set('signed-in')
      if (this.onlineStore.online()) {
        void this.refresh().catch(() => undefined)
      }
      return cached
    }
    if (!this.onlineStore.online()) {
      this.phase.set('anonymous')
      return null
    }
    try {
      return await this.refresh()
    } catch {
      this.phase.set('anonymous')
      return null
    }
  }

  private async clear(): Promise<void> {
    await this.meta.remove(META_SESSION)
    this.current.set(null)
    this.phase.set('anonymous')
  }
}
