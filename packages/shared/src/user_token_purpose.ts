/**
 * What a single-use user token is for, mirrored by the CHECK constraint on
 * `user_tokens.purpose`.
 */
export const USER_TOKEN_PURPOSES = ['verify_email', 'reset_password'] as const

export type UserTokenPurpose = (typeof USER_TOKEN_PURPOSES)[number]
