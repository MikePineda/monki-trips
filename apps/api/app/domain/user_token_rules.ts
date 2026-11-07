import type { UserTokenPurpose } from '@monkitrips/shared'

/** Lifetime and wrong-code allowance per token purpose. */
export const USER_TOKEN_RULES: Record<
  UserTokenPurpose,
  { ttlMinutes: number; maxAttempts: number }
> = {
  verify_email: { ttlMinutes: 15, maxAttempts: 5 },
  reset_password: { ttlMinutes: 60, maxAttempts: 1 },
}

export interface UserTokenFacts {
  purpose: UserTokenPurpose
  expiresAt: Date
  usedAt: Date | null
  attempts: number
}

export type UserTokenState = 'valid' | 'used' | 'expired' | 'exhausted'

/** When a token issued at `now` stops working. */
export function userTokenExpiry(purpose: UserTokenPurpose, now: Date): Date {
  return new Date(now.getTime() + USER_TOKEN_RULES[purpose].ttlMinutes * 60_000)
}

/**
 * Whether a token can still be consumed at `now`. `used` wins over
 * `expired`, and a token with too many wrong codes is `exhausted` even
 * before it expires.
 */
export function userTokenState(token: UserTokenFacts, now: Date): UserTokenState {
  if (token.usedAt) return 'used'
  if (token.attempts >= USER_TOKEN_RULES[token.purpose].maxAttempts) return 'exhausted'
  if (token.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'valid'
}
