import type { Locale } from './locales.ts'
import type { Theme } from './theme.ts'
import type { UserPlan } from './user_plan.ts'
import type { UserStatus } from './user_status.ts'

/**
 * The signed-in person as the API returns them (`GET /api/v1/auth/me`,
 * login, signup, `PATCH /api/v1/me`). Never includes the password hash or
 * the session version.
 */
export interface UserProfile {
  id: string
  email: string
  displayName: string
  locale: Locale
  /** IANA time zone of the person's home, e.g. `Australia/Sydney`. */
  timezone: string
  theme: Theme
  /** ISO instant, or null while the address is unverified. */
  emailVerifiedAt: string | null
  status: UserStatus
  plan: UserPlan
  /** ISO instant of the scheduled hard delete (30-day grace), or null. */
  deletionScheduledAt: string | null
  createdAt: string
}
