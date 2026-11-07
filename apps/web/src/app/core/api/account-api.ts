import { inject, InjectionToken } from '@angular/core'
import type { AccountExport, Theme, UserProfile } from '@monkitrips/shared'
import type { AppLang } from '../../domain/locale'
import { API } from './api'
import { FakeApi } from './fake-api'
import { RealAccountApi } from './real-account-api'

export interface UpdateProfileInput {
  displayName?: string
  locale?: AppLang
  timezone?: string
  theme?: Theme
}

/**
 * The signed-in person's own account: profile, password, export and
 * deletion. Failures are ApiFailures (`E_INVALID_PASSWORD`,
 * `E_SOLE_OWNER_OF_SHARED_TRIPS` with `details.tripIds`...).
 */
export interface AccountApi {
  updateProfile(input: UpdateProfileInput): Promise<UserProfile>
  /** Other sessions end, this one continues. */
  changePassword(input: { currentPassword: string; password: string }): Promise<void>
  exportData(): Promise<AccountExport>
  /** Schedules the hard delete and signs the person out everywhere. */
  deleteAccount(password: string): Promise<void>
}

/** In-memory stand-in: edits apply to `profile`. */
export class FakeAccountApi extends FakeApi implements AccountApi {
  profile: UserProfile = {
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

  updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
    return this.run('updateProfile', () => {
      this.profile = { ...this.profile, ...input }
      return this.profile
    })
  }

  changePassword(): Promise<void> {
    return this.run('changePassword', () => undefined)
  }

  exportData(): Promise<AccountExport> {
    return this.run('exportData', () => ({
      schemaVersion: 1,
      exportedAt: '2026-11-07T12:00:00.000Z',
      profile: this.profile,
      trips: [],
    }))
  }

  deleteAccount(): Promise<void> {
    return this.run('deleteAccount', () => undefined)
  }
}

export const ACCOUNT_API = new InjectionToken<AccountApi>('ACCOUNT_API', {
  providedIn: 'root',
  factory: () => new RealAccountApi(inject(API)),
})
