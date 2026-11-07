import { DateTime } from 'luxon'
import User from '#models/user'

/** The one password every synthetic account uses, so specs read like prose. */
export const TEST_PASSWORD = 'correct-horse-battery'

let sequence = 0

/**
 * A verified, active account with synthetic data. `email` defaults to a
 * unique `userN@example.com`; pass `emailVerifiedAt: null` for an unverified
 * one. Overrides are plain model attributes.
 */
export async function makeUser(
  overrides: Partial<Record<keyof User, unknown>> = {}
): Promise<User> {
  sequence += 1
  return User.create({
    email: `user${sequence}@example.com`,
    password: TEST_PASSWORD,
    displayName: `Traveller ${sequence}`,
    locale: 'en',
    timezone: 'UTC',
    emailVerifiedAt: DateTime.now(),
    ...overrides,
  } as Partial<User>)
}
