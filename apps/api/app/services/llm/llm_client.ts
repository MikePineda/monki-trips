import { inject } from '@adonisjs/core'
import type { LlmPurpose } from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type User from '#models/user'
import { Clock } from '#services/clock'
import {
  LlmProvider,
  LlmUnavailableError,
  type LlmCompletion,
  type LlmDelta,
  type LlmRequest,
} from '#services/llm/llm_provider'
import { LlmUsageService } from '#services/llm/llm_usage_service'

/** Who a call is for; every row of `llm_usage` carries it. */
export interface LlmCaller {
  user: User
  tripId: string | null
}

/**
 * The door every feature uses to talk to the model: checks the caller's
 * monthly cap before the call (402), hands the request to the bound
 * `LlmProvider`, records the usage whatever happens (`ok`, `error`) and
 * turns a provider failure into 503 `E_LLM_UNAVAILABLE`. Prompts and
 * answers are never logged.
 */
@inject()
export class LlmClient {
  constructor(
    private readonly provider: LlmProvider,
    private readonly usage: LlmUsageService,
    private readonly clock: Clock
  ) {}

  async complete(caller: LlmCaller, request: LlmRequest): Promise<LlmCompletion> {
    await this.usage.assertWithinCap(caller.user, {
      tripId: caller.tripId,
      purpose: request.purpose,
    })
    const startedAt = this.clock.now().getTime()
    try {
      const completion = await this.provider.complete(request)
      await this.recordOk(caller, request.purpose, completion, startedAt)
      return completion
    } catch (error) {
      await this.recordError(caller, request.purpose, startedAt)
      throw this.mapError(error)
    }
  }

  /** Streams the provider's deltas; usage is recorded when the stream ends or fails. */
  async *stream(caller: LlmCaller, request: LlmRequest): AsyncIterable<LlmDelta> {
    await this.usage.assertWithinCap(caller.user, {
      tripId: caller.tripId,
      purpose: request.purpose,
    })
    const startedAt = this.clock.now().getTime()
    let completion: LlmCompletion | null = null
    try {
      for await (const delta of this.provider.stream(request)) {
        if (delta.type === 'done') completion = delta.completion
        yield delta
      }
    } catch (error) {
      await this.recordError(caller, request.purpose, startedAt)
      throw this.mapError(error)
    }
    if (completion) await this.recordOk(caller, request.purpose, completion, startedAt)
  }

  private async recordOk(
    caller: LlmCaller,
    purpose: LlmPurpose,
    completion: LlmCompletion,
    startedAt: number
  ) {
    await this.usage.record({
      userId: caller.user.id,
      tripId: caller.tripId,
      purpose,
      provider: this.provider.name,
      model: completion.model,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
      latencyMs: this.clock.now().getTime() - startedAt,
      status: 'ok',
    })
  }

  private async recordError(caller: LlmCaller, purpose: LlmPurpose, startedAt: number) {
    await this.usage.record({
      userId: caller.user.id,
      tripId: caller.tripId,
      purpose,
      provider: this.provider.name,
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: this.clock.now().getTime() - startedAt,
      status: 'error',
    })
  }

  private mapError(error: unknown): unknown {
    if (error instanceof LlmUnavailableError) return new ApiException('E_LLM_UNAVAILABLE')
    return error
  }
}
