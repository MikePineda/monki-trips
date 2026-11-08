/** One push delivery outcome, as `PushSender` reports it. */
export interface PushOutcome {
  status: 'sent' | 'gone' | 'failed'
  statusCode?: number | null
}

const TOO_MANY_REQUESTS = 429
const FIRST_SERVER_ERROR = 500

/**
 * A failure that may succeed if sent again shortly: the push service
 * answered 5xx or 429, or there was no answer at all (timeout, network
 * error, `statusCode` null). A 404/410 (`gone`) or another 4xx (a bad key,
 * a payload too large) will fail the same way again.
 */
export function isTransientPushFailure(outcome: PushOutcome): boolean {
  if (outcome.status !== 'failed') return false
  const code = outcome.statusCode ?? null
  return code === null || code === TOO_MANY_REQUESTS || code >= FIRST_SERVER_ERROR
}
