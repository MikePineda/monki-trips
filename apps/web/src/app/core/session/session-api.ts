import { inject, InjectionToken } from '@angular/core'
import type { UserProfile } from '@monkitrips/shared'
import { API } from '../api/api'
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

export const SESSION_API = new InjectionToken<SessionApi>('SESSION_API', {
  providedIn: 'root',
  factory: () => new RealSessionApi(inject(API)),
})
