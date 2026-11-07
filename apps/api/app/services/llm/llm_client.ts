import { inject } from '@adonisjs/core'
import { ApiException } from '#exceptions/api_exception'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { estimateInputTokens } from '#services/llm/input_token_estimate'
import {
  LlmProvider,
  LlmUnavailableError,
  type LlmCompletion,
  type LlmDelta,
  type LlmRequest,
  type LlmUsage,
} from '#services/llm/llm_provider'
import { LlmUsageService } from '#services/llm/llm_usage_service'

/** Who a call is for; every row of `llm_usage` carries it. */
export interface LlmCaller {
  user: User
  tripId: string | null
}

/**
 * The door every feature uses to talk to the model: reserves the call's
 * tokens against the caller's monthly cap before it goes out (402 when they
 * do not fit), hands the request to the bound `LlmProvider`, settles the
 * reservation with what really happened (`ok`, `error`) and turns a
 * provider failure into 503 `E_LLM_UNAVAILABLE`. Prompts and answers are
 * never logged.
 */
@inject()
export class LlmClient {
  constructor(
    private readonly provider: LlmProvider,
    private readonly usage: LlmUsageService,
    private readonly clock: Clock
  ) {}

  async complete(caller: LlmCaller, request: LlmRequest): Promise<LlmCompletion> {
    const reservation = await this.reserve(caller, request)
    const startedAt = this.clock.now().getTime()
    let completion: LlmCompletion
    try {
      completion = await this.provider.complete(request)
    } catch (error) {
      await this.settleError(reservation, startedAt)
      throw this.mapError(error)
    }
    await this.settleOk(reservation, completion, startedAt)
    return completion
  }

  /**
   * Streams the provider's deltas; the reservation is settled when the
   * stream ends (`ok`), fails (`error`) or is stopped early by the consumer
   * (`aborted`, charged the last usage the provider reported, else the
   * input estimate).
   */
  async *stream(caller: LlmCaller, request: LlmRequest): AsyncIterable<LlmDelta> {
    const reservation = await this.reserve(caller, request)
    const startedAt = this.clock.now().getTime()
    let completion: LlmCompletion | null = null
    let known: { usage: LlmUsage; model: string } | null = null
    let failed = false
    try {
      const deltas = this.provider.stream(request, {
        onUsage: (usage, model) => {
          known = { usage, model }
        },
      })
      for await (const delta of deltas) {
        if (delta.type === 'done') completion = delta.completion
        yield delta
      }
    } catch (error) {
      failed = true
      await this.settleError(reservation, startedAt, known)
      throw this.mapError(error)
    } finally {
      if (completion) {
        await this.settleOk(reservation, completion, startedAt)
      } else if (!failed) {
        await this.settleAborted(reservation, request, known, startedAt)
      }
    }
  }

  /** Reserves the estimated input plus `maxTokens`; answers the usage row's id. */
  private reserve(caller: LlmCaller, request: LlmRequest): Promise<string> {
    return this.usage.reserve(caller.user, {
      tripId: caller.tripId,
      purpose: request.purpose,
      provider: this.provider.name,
      inputTokens: estimateInputTokens(request),
      outputTokens: request.maxTokens,
    })
  }

  private async settleOk(reservation: string, completion: LlmCompletion, startedAt: number) {
    await this.usage.settle(reservation, {
      model: completion.model,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
      latencyMs: this.clock.now().getTime() - startedAt,
      status: 'ok',
    })
  }

  private async settleAborted(
    reservation: string,
    request: LlmRequest,
    known: { usage: LlmUsage; model: string } | null,
    startedAt: number
  ) {
    await this.usage.settle(reservation, {
      model: known?.model ?? 'unknown',
      inputTokens: known?.usage.inputTokens ?? estimateInputTokens(request),
      outputTokens: known?.usage.outputTokens ?? 0,
      latencyMs: this.clock.now().getTime() - startedAt,
      status: 'aborted',
    })
  }

  /** A failed call: charged what the provider reported before failing, if anything. */
  private async settleError(
    reservation: string,
    startedAt: number,
    known: { usage: LlmUsage; model: string } | null = null
  ) {
    await this.usage.settle(reservation, {
      model: known?.model ?? 'unknown',
      inputTokens: known?.usage.inputTokens ?? 0,
      outputTokens: known?.usage.outputTokens ?? 0,
      latencyMs: this.clock.now().getTime() - startedAt,
      status: 'error',
    })
  }

  private mapError(error: unknown): unknown {
    if (error instanceof LlmUnavailableError) return new ApiException('E_LLM_UNAVAILABLE')
    return error
  }
}
