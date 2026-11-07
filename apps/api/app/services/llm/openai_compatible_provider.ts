import {
  LlmProvider,
  LlmUnavailableError,
  type LlmCompletion,
  type LlmDelta,
  type LlmRequest,
} from '#services/llm/llm_provider'

/**
 * The seam for an OpenAI-compatible endpoint (`LLM_PROVIDER=openai`). Not
 * written yet: every call answers "not configured", which the API maps to
 * 503 `E_LLM_UNAVAILABLE`, so choosing it never crashes a deployment. The
 * contract above it (`LlmProvider`) is all a real adapter has to meet.
 */
export class OpenAiCompatibleProvider extends LlmProvider {
  readonly name = 'openai'

  async complete(_request: LlmRequest): Promise<LlmCompletion> {
    throw new LlmUnavailableError('openai-compatible provider is not configured')
  }

  async *stream(_request: LlmRequest): AsyncIterable<LlmDelta> {
    throw new LlmUnavailableError('openai-compatible provider is not configured')
  }
}
