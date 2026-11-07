/**
 * Billing plan, mirrored by the CHECK constraint on `users.plan`. It only
 * drives quotas (the LLM token cap); it grants no privilege. Changed by
 * `node ace users:plan`.
 */
export const USER_PLANS = ['free', 'pro'] as const

export type UserPlan = (typeof USER_PLANS)[number]
