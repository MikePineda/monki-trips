/**
 * LLM settings that are not secrets: the default endpoint, the wire version
 * the adapter speaks, timeouts, retries and the price table that turns
 * token counts into `llm_usage.cost_micros`. Which provider runs, its key
 * and its models come from the environment (`LLM_*`, start/env_schema.ts).
 */

/** Anthropic's own endpoint; `LLM_BASE_URL` points elsewhere (MiniMax's compatible endpoint, a proxy). */
export const LLM_DEFAULT_BASE_URL = 'https://api.anthropic.com'

/**
 * The Messages API version the adapter sends. The 2023-06-01 wire shape is
 * what every compatible endpoint speaks and Anthropic still serves it.
 */
export const LLM_ANTHROPIC_VERSION = '2023-06-01'

/** Wall-clock limit of one request (streaming included). */
export const LLM_REQUEST_TIMEOUT_MS = 90_000

/** Attempts after the first one on 429, 5xx and network failures, with these waits in between. */
export const LLM_RETRY_DELAYS_MS = [500, 2_000]

/** Output tokens one structured answer may use (phrase cards, extractions). */
export const LLM_STRUCTURED_MAX_TOKENS = 8_192

/**
 * Price per million tokens in USD, by model id, for the cost column. A
 * model that is not listed gets a null cost (the tokens still count against
 * the cap). Update when the provider changes its list prices.
 */
export interface LlmModelPrice {
  inputUsdPerMillion: number
  outputUsdPerMillion: number
}

export const LLM_PRICES: Readonly<Record<string, LlmModelPrice>> = {
  'MiniMax-M2': { inputUsdPerMillion: 0.3, outputUsdPerMillion: 1.2 },
  'claude-opus-5-5': { inputUsdPerMillion: 4, outputUsdPerMillion: 20 },
  'claude-sonnet-5-5': { inputUsdPerMillion: 2, outputUsdPerMillion: 10 },
  'claude-haiku-5-5': { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5 },
}
