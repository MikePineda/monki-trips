import type { UserProfile } from '@monkitrips/shared'
import type User from '#models/user'

/** The account as the API shows it to its owner: no hash, no session version. */
export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    timezone: user.timezone,
    theme: user.theme,
    emailVerifiedAt: user.emailVerifiedAt?.toISO() ?? null,
    status: user.status,
    plan: user.plan,
    deletionScheduledAt: user.deletionScheduledAt?.toISO() ?? null,
    createdAt: user.createdAt.toISO()!,
  }
}
