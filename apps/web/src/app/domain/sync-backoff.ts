/**
 * How long the outbox waits before resending a mutation that hit a network
 * error or a 5xx: 1 s, 2 s, 4 s... doubling per attempt, capped at a minute.
 * Pure: the caller adds the result to its own `now`.
 */
export const BASE_BACKOFF_MS = 1000
export const MAX_BACKOFF_MS = 60_000

export function backoffMs(attempt: number): number {
  const exponent = Math.max(0, Math.floor(attempt))
  // 2^6 s already exceeds the cap; clamping the exponent avoids Infinity.
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.min(exponent, 30), MAX_BACKOFF_MS)
}
