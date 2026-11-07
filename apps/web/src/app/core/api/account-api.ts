import { inject, InjectionToken } from '@angular/core'
import type { AccountExport, Theme, UserProfile } from '@monkitrips/shared'
import type { AppLang } from '../../domain/locale'
import { API } from './api'
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

export const ACCOUNT_API = new InjectionToken<AccountApi>('ACCOUNT_API', {
  providedIn: 'root',
  factory: () => new RealAccountApi(inject(API)),
})
