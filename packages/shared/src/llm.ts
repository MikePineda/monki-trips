/**
 * What the API records about LLM calls. Mirrors the CHECK constraints on
 * `llm_usage` (`purpose`, `status`).
 */
export const LLM_PURPOSES = ['chat', 'extract_booking', 'phrase_cards'] as const

export type LlmPurpose = (typeof LLM_PURPOSES)[number]

/**
 * `pending`: a call in flight, reserving its estimated input plus
 * `maxTokens` against the cap until it settles (ignored once older than
 * ten minutes). `aborted`: a stream the consumer stopped early.
 */
export const LLM_USAGE_STATUSES = ['ok', 'error', 'quota_exceeded', 'pending', 'aborted'] as const

export type LlmUsageStatus = (typeof LLM_USAGE_STATUSES)[number]

/** Extra fields of a 402 `E_LLM_QUOTA_EXCEEDED` answer. */
export interface LlmQuotaExceededPayload {
  /** Tokens (input plus output) spent this UTC month, plus those reserved by calls in flight. */
  used: number
  /** The monthly cap for this account. */
  cap: number
  /** First day of the next UTC month, `YYYY-MM-DD`. */
  resetsOn: string
}
