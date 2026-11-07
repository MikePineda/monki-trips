import type { LlmModelPrice } from '#config/llm'

/**
 * The cost of one call in micro-dollars (1 USD = 1 000 000), from the price
 * table in USD per million tokens: `tokens × usdPerMillion` is exactly the
 * number of micro-dollars, so no float division happens. Unknown model:
 * null (the tokens still count against the cap).
 */
export function llmCostMicros(
  prices: Readonly<Record<string, LlmModelPrice>>,
  model: string,
  usage: { inputTokens: number; outputTokens: number }
): number | null {
  const price = prices[model]
  if (!price) return null
  return Math.round(
    usage.inputTokens * price.inputUsdPerMillion + usage.outputTokens * price.outputUsdPerMillion
  )
}
