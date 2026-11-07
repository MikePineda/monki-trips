import { Injectable, computed, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { ApiFailure } from '../api/api-failure'
import { OFFLINE_DB } from '../offline/offline-db'
import { META_SESSION, MetaStore } from '../offline/meta.store'
import { OnlineStore } from '../offline/online.store'
import { SESSION_API, type LoginInput, type SessionUser } from './session-api'

export type SessionState = 'unknown' | 'anonymous' | 'signed-in'

/** Query parameter the sign-in page sends people back with. */
export const RETURN_URL_PARAM = 'returnUrl'

/**
 * Who is signed in. The answer is cached in Dexie (`meta.session`) so the
 * app boots without network and is never kicked to /login while offline;
 * with network, `/me` refreshes it and a 401 clears it. Signing out tells
 * the server and wipes the device's copy of every trip.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(SESSION_API)
  private readonly meta = inject(MetaStore)
  private readonly database = inject(OFFLINE_DB)
  private readonly onlineStore = inject(OnlineStore)
  private readonly router = inject(Router)
  private readonly current = signal<SessionUser | null>(null)
  private readonly phase = signal<SessionState>('unknown')
  private restoring: Promise<SessionUser | null> | null = null

  readonly user = this.current.asReadonly()
  readonly state = this.phase.asReadonly()
  readonly signedIn = computed(() => this.phase() === 'signed-in')
  readonly emailVerified = computed(() => this.current()?.emailVerifiedAt !== null)

  /**
   * The cached session, refreshed from the network when possible. Cached
   * user: answer at once and refresh in the background. No cache: ask the
   * server when online, otherwise stay anonymous for now. Runs once; later
   * calls share the result.
   */
  restore(): Promise<SessionUser | null> {
    // Once the session is known, later callers (guards after a sign-in) get the current answer.
    if (this.phase() !== 'unknown') {
      return Promise.resolve(this.current())
    }
    this.restoring ??= this.restoreOnce()
    return this.restoring
  }

  /** `/me` now: updates the cache, or clears it on 401. Network errors keep the cache. */
  async refresh(): Promise<SessionUser | null> {
    const user = await this.api.me()
    if (user) {
      await this.setUser(user)
    } else {
      await this.clear()
    }
    return user
  }

  /** Signs in; the ApiFailure of a wrong password or a throttle reaches the screen. */
  async login(input: LoginInput): Promise<SessionUser> {
    const user = await this.api.login(input)
    await this.setUser(user)
    return user
  }

  /** A fresh profile (signup, verification, profile edits) becomes the session. */
  async setUser(user: SessionUser): Promise<void> {
    await this.meta.set(META_SESSION, user)
    this.current.set(user)
    this.phase.set('signed-in')
  }

  /**
   * Ends the session on the server and forgets everything on the device
   * (trips, outbox, meta). A server that already dropped the session (4xx)
   * still signs out locally; with no answer at all the session stays, so
   * the person knows nothing happened.
   */
  async signOut(): Promise<void> {
    try {
      await this.api.logout()
    } catch (error) {
      if (!(error instanceof ApiFailure) || error.kind !== 'http') {
        throw error
      }
    }
    await this.forgetDevice()
  }

  /** Ends every other session; this one continues. */
  async signOutEverywhere(): Promise<void> {
    await this.api.logoutAll()
  }

  /**
   * A protected call answered 401 while online: the session is gone. Clears
   * it and sends the person to sign in, keeping where they were.
   */
  async expire(returnUrl: string = this.router.url): Promise<void> {
    await this.clear()
    await this.router.navigate(['/login'], { queryParams: { [RETURN_URL_PARAM]: returnUrl } })
  }

  /**
   * Whether an ApiFailure means the session ended; true also runs `expire()`.
   * Guards pass the URL being opened: the router still reports the previous one.
   */
  async handleUnauthorized(error: unknown, returnUrl?: string): Promise<boolean> {
    if (error instanceof ApiFailure && error.isStatus(401) && this.onlineStore.online()) {
      await this.expire(returnUrl)
      return true
    }
    return false
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

  private async forgetDevice(): Promise<void> {
    const db = await this.database
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()))
    })
    this.current.set(null)
    this.phase.set('anonymous')
  }
}
