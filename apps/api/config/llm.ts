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
 * The input estimate made before a call (`input_token_estimate.ts`): one
 * token per this many characters, and a flat count per image (a phone
 * photo is roughly 1.5k tokens on Anthropic's scale).
 */
export const LLM_CHARS_PER_TOKEN = 4
export const LLM_IMAGE_TOKEN_ESTIMATE = 1_600

/**
 * A PDF sent as a document block is read page by page as text and as an
 * image (Anthropic counts roughly 1.5k to 3k tokens a page); the estimate
 * takes the upper middle.
 */
export const LLM_DOCUMENT_PAGE_TOKEN_ESTIMATE = 2_500

/**
 * A `pending` usage row reserves the tokens of a call in flight. One older
 * than this belongs to a process that died before settling it, and stops
 * counting against the cap.
 */
export const LLM_PENDING_TTL_MS = 10 * 60_000

/**
 * The languages phrase cards can be generated in, as canonical tags. A
 * request for anything else answers 422 before the model is asked. Edit
 * freely: a regional form (`pt-BR`) is its own entry, so the list also
 * bounds how many sets one trip can ask for.
 */
export const PHRASE_CARD_LANGUAGES: readonly string[] = [
  'th',
  'ja',
  'ko',
  'zh-Hans',
  'zh-Hant',
  'vi',
  'id',
  'ms',
  'fr',
  'de',
  'it',
  'es',
  'pt',
  'pt-BR',
  'en',
  'km',
  'lo',
  'my',
]

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
