/**
 * Account status, mirrored by the CHECK constraint on `users.status`.
 * `disabled` accounts cannot sign in; every session is revoked when the
 * status changes (`node ace users:disable`).
 */
export const USER_STATUSES = ['active', 'disabled'] as const

export type UserStatus = (typeof USER_STATUSES)[number]
