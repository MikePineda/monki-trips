import type { LoginInput, SessionApi, SessionUser } from '../app/core/session/session-api'
import { FakeApi } from './fake-api'

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
  /** Who the next login signs in as; by default the fake traveller with the e-mail typed. */
  loginAs: SessionUser | null = null

  me(): Promise<SessionUser | null> {
    return this.run('me', () => this.user)
  }

  login(input: LoginInput): Promise<SessionUser> {
    return this.run(`login:${input.email}`, () => {
      this.user = this.loginAs ?? { ...FAKE_SESSION_USER, email: input.email }
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
