import { inject, InjectionToken } from '@angular/core'
import type { UserProfile } from '@monkitrips/shared'
import { API } from '../api/api'
import { FakeApi } from '../api/fake-api'
import { RealSessionApi } from '../api/real-session-api'

/** The signed-in person as `GET /auth/me` returns them. */
export type SessionUser = UserProfile

export interface LoginInput {
  email: string
  password: string
}

/**
 * What the session store needs from the network. Failures are ApiFailures
 * (`kind: 'network'` when no answer came back); `me()` turns a 401 into
 * `null` because "nobody is signed in" is an answer, not a failure.
 */
export interface SessionApi {
  /** The current user, or null when the server answers 401. Throws on network failure. */
  me(): Promise<SessionUser | null>
  /** Signs in; throws `E_INVALID_CREDENTIALS`, `E_ACCOUNT_DISABLED`, a 429 or a network failure. */
  login(input: LoginInput): Promise<SessionUser>
  /** Ends this session only. */
  logout(): Promise<void>
  /** Ends every other session; this one continues. */
  logoutAll(): Promise<void>
}

/** A synthetic traveller the fake API signs everyone in as. */
export const FAKE_SESSION_USER: SessionUser = {
  id: 'local-traveller',
  email: 'traveller@example.com',
  displayName: 'Traveller',
  locale: 'en',
  timezone: 'UTC',
  theme: 'system',
  emailVerifiedAt: '2026-11-01T00:00:00.000Z',
  status: 'active',
  plan: 'free',
  deletionScheduledAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
}

/** In-memory stand-in: always signed in. Specs flip its knobs. */
export class FakeSessionApi extends FakeApi implements SessionApi {
  user: SessionUser | null = FAKE_SESSION_USER

  me(): Promise<SessionUser | null> {
    return this.run('me', () => this.user)
  }

  login(input: LoginInput): Promise<SessionUser> {
    return this.run(`login:${input.email}`, () => {
      this.user = { ...FAKE_SESSION_USER, email: input.email }
      return this.user
    })
  }

  logout(): Promise<void> {
    return this.run('logout', () => {
      this.user = null
    })
  }

  logoutAll(): Promise<void> {
    return this.run('logoutAll', () => undefined)
  }
}

export const SESSION_API = new InjectionToken<SessionApi>('SESSION_API', {
  providedIn: 'root',
  factory: () => new RealSessionApi(inject(API)),
})
