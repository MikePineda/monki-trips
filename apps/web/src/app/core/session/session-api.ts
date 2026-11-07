import { InjectionToken } from '@angular/core'
import type { AppLang } from '../../domain/locale'

/** The signed-in person as `GET /me` returns them (minimal until WP 0.6b). */
export interface SessionUser {
  id: string
  displayName: string
  locale?: AppLang
}

/**
 * What the session store needs from the network. The real implementation
 * (Tuyau client, WP 0.6b) replaces the token's factory; nothing else moves.
 */
export interface SessionApi {
  /** The current user, or null when the server answers 401. Throws on network failure. */
  me(): Promise<SessionUser | null>
  /** Whether the current user may open the trip (a foreign trip is "not found"). */
  canOpenTrip(tripId: string): Promise<boolean>
}

/** A synthetic traveller the fake API signs everyone in as. */
export const FAKE_SESSION_USER: SessionUser = { id: 'local-traveller', displayName: 'Traveller' }

/** In-memory stand-in: always signed in, every trip open. Specs flip its knobs. */
export class FakeSessionApi implements SessionApi {
  user: SessionUser | null = FAKE_SESSION_USER
  openTrips: 'all' | Set<string> = 'all'
  /** When set, the next call throws it (network failure). */
  failWith: unknown = null
  readonly calls: string[] = []

  async me(): Promise<SessionUser | null> {
    this.calls.push('me')
    this.throwIfFailing()
    return this.user
  }

  async canOpenTrip(tripId: string): Promise<boolean> {
    this.calls.push(`canOpenTrip:${tripId}`)
    this.throwIfFailing()
    return this.openTrips === 'all' || this.openTrips.has(tripId)
  }

  private throwIfFailing(): void {
    if (this.failWith) {
      const error = this.failWith
      this.failWith = null
      throw error
    }
  }
}

export const SESSION_API = new InjectionToken<SessionApi>('SESSION_API', {
  providedIn: 'root',
  factory: () => new FakeSessionApi(),
})
