import type { UserPlan } from '@monkitrips/shared'

/**
 * What each plan allows. Plans grant no privilege: they only size quotas.
 * `LLM_MONTHLY_TOKEN_CAP_OVERRIDE` replaces the token caps for every
 * account of a deployment (a self-hoster with one household, a test).
 */
export interface PlanLimits {
  /** LLM tokens (input plus output) per account and UTC month. */
  llmMonthlyTokenCap: number
}

export const PLANS: Readonly<Record<UserPlan, PlanLimits>> = {
  free: { llmMonthlyTokenCap: 200_000 },
  pro: { llmMonthlyTokenCap: 3_000_000 },
}
