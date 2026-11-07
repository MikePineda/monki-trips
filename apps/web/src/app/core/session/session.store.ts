import { Injectable, computed, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { ApiFailure } from '../api/api-failure'
import { OFFLINE_DB } from '../offline/offline-db'
import type { MonkiTripsDb } from '../offline/db'
import { DEVICE_META_KEYS, META_DEVICE_USER, META_SESSION, MetaStore } from '../offline/meta.store'
import { OnlineStore } from '../offline/online.store'
import { ForeignChangesError } from './foreign-changes.error'
import { SESSION_API, type LoginInput, type SessionUser } from './session-api'

export type SessionState = 'unknown' | 'anonymous' | 'signed-in'

/** Query parameter the sign-in page sends people back with. */
export const RETURN_URL_PARAM = 'returnUrl'

/**
 * Who is signed in. The answer is cached in Dexie (`meta.session`) so the
 * app boots without network and is never kicked to /login while offline;
 * with network, `/me` refreshes it and a 401 clears it. Signing out tells
 * the server and wipes the device's copy of every trip.
 *
 * The device's data belongs to one account (`meta.device.userId`). A 401
 * keeps it for that account; when another account signs in on the device
 * the copy is wiped first (trips, members, cursor, active trip, documents),
 * so nobody sees what the previous person cached. Unsynced changes of the
 * previous account are never dropped silently: the sign-in stops with a
 * ForeignChangesError until the person discards them or signs out again.
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

  /**
   * `/me` now: updates the cache, or clears it on 401. Network errors keep
   * the cache. A server session of another account while the device holds
   * unsynced changes of this one ends the local session (ForeignChangesError).
   */
  async refresh(): Promise<SessionUser | null> {
    const user = await this.api.me()
    if (!user) {
      await this.clear()
      return null
    }
    try {
      await this.setUser(user)
    } catch (error) {
      if (error instanceof ForeignChangesError) {
        await this.clear()
      }
      throw error
    }
    return user
  }

  /**
   * Signs in; the ApiFailure of a wrong password or a throttle reaches the
   * screen, and so does a ForeignChangesError (see the class).
   */
  async login(input: LoginInput): Promise<SessionUser> {
    const user = await this.api.login(input)
    await this.setUser(user)
    return user
  }

  /**
   * A fresh profile (sign-in, signup, verification, profile edits) becomes
   * the session. Another account than the device's wipes the device copy
   * first, or throws ForeignChangesError while the outbox holds its changes.
   */
  async setUser(user: SessionUser): Promise<void> {
    await this.claimDevice(user)
    await this.meta.set(META_SESSION, user)
    this.current.set(user)
    this.phase.set('signed-in')
  }

  /**
   * Ends the session on the server and forgets everything on the device
   * (trips, outbox, meta). Only a server that says the session is already
   * gone (401, 419) counts as done; a stale CSRF token is refreshed with one
   * GET and the sign-out sent once more. Anything else (a 5xx, no answer)
   * keeps the session and the device copy and reaches the caller: the
   * httpOnly cookie would still be valid, so wiping the device would only
   * sign the person back in silently on the next load.
   */
  async signOut(): Promise<void> {
    await this.endServerSession()
    await this.forgetDevice()
  }

  /**
   * The answer to a ForeignChangesError: drop the other account's unsynced
   * changes with the rest of its device copy, then continue as `user`.
   */
  async discardForeignChanges(user: SessionUser): Promise<void> {
    const db = await this.database
    await this.wipeDeviceCopy(db, { keepOutbox: false })
    await this.meta.set(META_DEVICE_USER, user.id)
    await this.setUser(user)
  }

  /**
   * The other answer: keep those changes and end the server session the
   * sign-in just opened (best effort), so their account can sign back in.
   */
  async abandonSignIn(): Promise<void> {
    await this.api.logout().catch(() => undefined)
    this.current.set(null)
    this.phase.set('anonymous')
  }

  /**
   * The account was deleted (204): the server already ended every session.
   * The device forgets everything whatever the logout answers; the logout
   * only clears this browser's cookie, best effort.
   */
  async leaveDeletedAccount(): Promise<void> {
    await this.api.logout().catch(() => undefined)
    await this.forgetDevice()
  }

  /** Ends every other session; this one continues. */
  async signOutEverywhere(): Promise<void> {
    await this.api.logoutAll()
  }

  /**
   * A protected call answered 401 while online: the session is gone. Clears
   * it and sends the person to sign in, keeping where they were. The device
   * copy stays, still owned by the same account: only that account gets it
   * back by signing in again; anyone else starts from a clean device.
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

  private async endServerSession(retried = false): Promise<void> {
    try {
      await this.api.logout()
    } catch (error) {
      if (!(error instanceof ApiFailure)) {
        throw error
      }
      if (error.isStatus(401) || error.isStatus(419)) {
        return
      }
      if (error.is('E_BAD_CSRF_TOKEN') && !retried) {
        // Any GET hands out a fresh XSRF cookie; /me also says whether the session still exists.
        if ((await this.api.me()) === null) {
          return
        }
        await this.endServerSession(true)
        return
      }
      throw error
    }
  }

  private async restoreOnce(): Promise<SessionUser | null> {
    const cached = await this.meta.get<SessionUser>(META_SESSION)
    if (cached) {
      // A device copy written before owners were recorded belongs to its cached session.
      if ((await this.meta.get<string>(META_DEVICE_USER)) === undefined) {
        await this.meta.set(META_DEVICE_USER, cached.id)
      }
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

  /** Makes `user` the device's owner; another account's copy goes first (see setUser). */
  private async claimDevice(user: SessionUser): Promise<void> {
    const owner = await this.meta.get<string>(META_DEVICE_USER)
    if (owner === user.id) {
      return
    }
    const db = await this.database
    // No owner yet: a fresh device, or one written before owners were recorded.
    if (owner !== undefined) {
      const unsynced = await db.outbox.count()
      if (unsynced > 0) {
        throw new ForeignChangesError(user, unsynced)
      }
      await this.wipeDeviceCopy(db, { keepOutbox: true })
    }
    await this.meta.set(META_DEVICE_USER, user.id)
  }

  /** Every table but the outbox (unless asked) and the device's own meta facts. */
  private async wipeDeviceCopy(db: MonkiTripsDb, options: { keepOutbox: boolean }): Promise<void> {
    const tables = db.tables.filter((table) => !(options.keepOutbox && table.name === 'outbox'))
    await db.transaction('rw', tables, async () => {
      await Promise.all(
        tables.map((table) =>
          table.name === 'meta'
            ? db.meta
                .where('key')
                .noneOf([...DEVICE_META_KEYS])
                .delete()
            : table.clear()
        )
      )
    })
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
