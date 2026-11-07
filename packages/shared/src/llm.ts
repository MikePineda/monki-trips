/**
 * What the API records about LLM calls. Mirrors the CHECK constraints on
 * `llm_usage` (`purpose`, `status`).
 */
export const LLM_PURPOSES = ['chat', 'extract_booking', 'phrase_cards'] as const

export type LlmPurpose = (typeof LLM_PURPOSES)[number]

export const LLM_USAGE_STATUSES = ['ok', 'error', 'quota_exceeded'] as const

export type LlmUsageStatus = (typeof LLM_USAGE_STATUSES)[number]

/** Extra fields of a 402 `E_LLM_QUOTA_EXCEEDED` answer. */
export interface LlmQuotaExceededPayload {
  /** Tokens (input plus output) spent this UTC month. */
  used: number
  /** The monthly cap for this account. */
  cap: number
  /** First day of the next UTC month, `YYYY-MM-DD`. */
  resetsOn: string
}
