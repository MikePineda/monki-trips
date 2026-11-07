import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { LlmPurpose, LlmQuotaExceededPayload, LlmUsageStatus } from '@monkitrips/shared'
import env from '#start/env'
import { LLM_PENDING_TTL_MS, LLM_PRICES } from '#config/llm'
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

/** One aggregate row of `totalsByUser`, as `pg` returns it (sums and counts as strings). */
interface TotalsRow {
  user_id: string | null
  calls: string | number
  tokens_in: string | number | null
  tokens_out: string | number | null
  cost_micros: string | number | null
  unpriced: string | number
}

/** What a call reserves before it goes out. */
export interface LlmReservationRequest {
  tripId: string | null
  purpose: LlmPurpose
  provider: string
  /** The estimate of the request's input tokens. */
  inputTokens: number
  /** The request's `maxTokens`: the most it can answer. */
  outputTokens: number
}

/** How a reserved call ended; the row takes these real numbers. */
export interface LlmSettlement {
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number | null
  status: Exclude<LlmUsageStatus, 'pending' | 'quota_exceeded'>
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
 *
 * A call reserves before it goes out: under a per-account advisory lock,
 * its row is written as `pending` with the estimated input and `maxTokens`,
 * so calls in parallel see each other and cannot together pass the cap.
 * The row is settled with the real numbers when the call ends; a `pending`
 * row older than `LLM_PENDING_TTL_MS` (its process died) stops counting.
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

  /** Tokens (input plus output) the account spent in the month of `now`, live reservations included. */
  async usedThisMonth(
    userId: string,
    month: UsageMonth = usageMonthOf(this.clock.now()),
    client: QueryClientContract = db.connection()
  ) {
    const liveSince = new Date(this.clock.now().getTime() - LLM_PENDING_TTL_MS)
    const [row] = await client
      .from('llm_usage')
      .where('user_id', userId)
      .where('created_at', '>=', month.startsAt)
      .where('created_at', '<', month.endsAt)
      .where((query) => query.whereNot('status', 'pending').orWhere('created_at', '>=', liveSince))
      .sum({ tokens_in: 'tokens_in', tokens_out: 'tokens_out' })
    return Number(row?.tokens_in ?? 0) + Number(row?.tokens_out ?? 0)
  }

  async tokensLeft(user: User): Promise<number> {
    return tokensLeft(this.capFor(user), await this.usedThisMonth(user.id))
  }

  /**
   * Reserves a call's tokens and answers the `pending` row's id, or throws
   * 402 `E_LLM_QUOTA_EXCEEDED` (with `used`, `cap`, `resetsOn`) after
   * logging the refused call when the reservation does not fit what is
   * left. Serialised per account, so parallel calls cannot both fit.
   */
  async reserve(user: User, call: LlmReservationRequest): Promise<string> {
    const month = usageMonthOf(this.clock.now())
    const cap = this.capFor(user)
    const reservation = call.inputTokens + call.outputTokens
    const outcome = await db.transaction(async (trx) => {
      await trx.rawQuery("select pg_advisory_xact_lock(hashtext('llm:' || ?::text))", [user.id])
      const used = await this.usedThisMonth(user.id, month, trx)
      if (used + reservation > cap) {
        await this.insert(trx, {
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
        return {
          refused: { used, cap, resetsOn: month.resetsOn } satisfies LlmQuotaExceededPayload,
        }
      }
      const id = await this.insert(trx, {
        userId: user.id,
        tripId: call.tripId,
        purpose: call.purpose,
        provider: call.provider,
        model: 'unknown',
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        latencyMs: null,
        status: 'pending',
      })
      return { id }
    })
    if ('refused' in outcome) {
      throw new ApiException('E_LLM_QUOTA_EXCEEDED', { ...outcome.refused })
    }
    return outcome.id
  }

  /** Replaces a reservation with what the call really used (and its cost). */
  async settle(id: string, settlement: LlmSettlement): Promise<void> {
    await db
      .from('llm_usage')
      .where('id', id)
      .update({
        model: settlement.model,
        tokens_in: settlement.inputTokens,
        tokens_out: settlement.outputTokens,
        latency_ms: settlement.latencyMs,
        status: settlement.status,
        cost_micros: llmCostMicros(LLM_PRICES, settlement.model, settlement),
      })
  }

  /** One row per call; the cost comes from the price table (null for an unlisted model). */
  async record(call: LlmUsageRecord): Promise<void> {
    await this.insert(db.connection(), call)
  }

  private async insert(client: QueryClientContract, call: LlmUsageRecord): Promise<string> {
    const [row] = (await client
      .table('llm_usage')
      .insert({
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
      .returning('id')) as { id: string }[]
    return row.id
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
      .orderByRaw('sum(tokens_in) + sum(tokens_out) desc')) as TotalsRow[]
    return rows.map((row) => ({
      userId: row.user_id ?? null,
      calls: Number(row.calls),
      inputTokens: Number(row.tokens_in ?? 0),
      outputTokens: Number(row.tokens_out ?? 0),
      costMicros: Number(row.unpriced) > 0 ? null : Number(row.cost_micros ?? 0),
    }))
  }
}
