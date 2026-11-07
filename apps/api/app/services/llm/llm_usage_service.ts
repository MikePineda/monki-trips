import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { LlmPurpose, LlmQuotaExceededPayload, LlmUsageStatus } from '@monkitrips/shared'
import env from '#start/env'
import { LLM_PRICES } from '#config/llm'
import { PLANS } from '#config/plans'
import { ApiException } from '#exceptions/api_exception'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { llmCostMicros } from '#domain/llm_cost'
import { tokensLeft, usageMonthOf, type UsageMonth } from '#domain/usage_month'

export interface LlmUsageRecord {
  userId: string | null
  tripId: string | null
  purpose: LlmPurpose
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number | null
  status: LlmUsageStatus
}

export interface LlmUsageTotals {
  userId: string | null
  calls: number
  inputTokens: number
  outputTokens: number
  costMicros: number | null
}

/**
 * The ledger of model calls (`llm_usage`) and the monthly cap it enforces:
 * every call, successful or not, leaves one row with its tokens and cost;
 * the tokens of a UTC month are summed per account and compared with the
 * plan's cap (`config/plans.ts`) or `LLM_MONTHLY_TOKEN_CAP_OVERRIDE`.
 */
@inject()
export class LlmUsageService {
  constructor(private readonly clock: Clock) {}

  /** The cap that applies to `user`: the deployment override, else the plan's. */
  capFor(user: Pick<User, 'plan'>): number {
    const override = env.get('LLM_MONTHLY_TOKEN_CAP_OVERRIDE')
    if (override !== undefined && Number.isFinite(override) && override >= 0) return override
    return PLANS[user.plan].llmMonthlyTokenCap
  }

  /** Tokens (input plus output) the account spent in the month of `now`. */
  async usedThisMonth(userId: string, month: UsageMonth = usageMonthOf(this.clock.now())) {
    const [row] = await db
      .from('llm_usage')
      .where('user_id', userId)
      .where('created_at', '>=', month.startsAt)
      .where('created_at', '<', month.endsAt)
      .sum({ tokens_in: 'tokens_in', tokens_out: 'tokens_out' })
    return Number(row?.tokens_in ?? 0) + Number(row?.tokens_out ?? 0)
  }

  async tokensLeft(user: User): Promise<number> {
    return tokensLeft(this.capFor(user), await this.usedThisMonth(user.id))
  }

  /**
   * Throws 402 `E_LLM_QUOTA_EXCEEDED` (with `used`, `cap`, `resetsOn`) when
   * the account has no tokens left, after logging the refused call.
   */
  async assertWithinCap(user: User, call: { tripId: string | null; purpose: LlmPurpose }) {
    const month = usageMonthOf(this.clock.now())
    const used = await this.usedThisMonth(user.id, month)
    const cap = this.capFor(user)
    if (used < cap) return
    await this.record({
      userId: user.id,
      tripId: call.tripId,
      purpose: call.purpose,
      provider: 'none',
      model: 'none',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: null,
      status: 'quota_exceeded',
    })
    const payload: LlmQuotaExceededPayload = { used, cap, resetsOn: month.resetsOn }
    throw new ApiException('E_LLM_QUOTA_EXCEEDED', { ...payload })
  }

  /** One row per call; the cost comes from the price table (null for an unlisted model). */
  async record(call: LlmUsageRecord): Promise<void> {
    await db.table('llm_usage').insert({
      user_id: call.userId,
      trip_id: call.tripId,
      purpose: call.purpose,
      provider: call.provider,
      model: call.model,
      tokens_in: call.inputTokens,
      tokens_out: call.outputTokens,
      latency_ms: call.latencyMs,
      status: call.status,
      cost_micros: llmCostMicros(LLM_PRICES, call.model, call),
      created_at: this.clock.now(),
    })
  }

  /** Per-account totals of a month, biggest spender first; `costMicros` is null when any call had no price. */
  async totalsByUser(month: UsageMonth): Promise<LlmUsageTotals[]> {
    const rows = (await db
      .from('llm_usage')
      .where('created_at', '>=', month.startsAt)
      .where('created_at', '<', month.endsAt)
      .select('user_id')
      .count({ calls: '*' })
      .sum({ tokens_in: 'tokens_in', tokens_out: 'tokens_out', cost_micros: 'cost_micros' })
      .count({ unpriced: db.raw('case when cost_micros is null then 1 end') })
      .groupBy('user_id')
      .orderByRaw('sum(tokens_in) + sum(tokens_out) desc')) as Record<string, unknown>[]
    return rows.map((row) => ({
      userId: (row.user_id as string | null) ?? null,
      calls: Number(row.calls),
      inputTokens: Number(row.tokens_in ?? 0),
      outputTokens: Number(row.tokens_out ?? 0),
      costMicros: Number(row.unpriced) > 0 ? null : Number(row.cost_micros ?? 0),
    }))
  }
}
