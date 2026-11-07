import type { AccountExport, UserProfile } from '@monkitrips/shared'
import type { AccountApi, UpdateProfileInput } from '../app/core/api/account-api'
import { FakeApi } from './fake-api'

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
