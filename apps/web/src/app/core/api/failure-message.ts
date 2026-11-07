import type { ApiFailure } from './api-failure'

export interface FailureMessage {
  /** Translation key inside the given scope (`auth.errors.E_INVALID_CREDENTIALS`). */
  key: string
  params: Record<string, string | number>
  /**
   * The server's own (localised) message, for codes the catalogue does not
   * know; empty when the answer carried no message meant for people (a 5xx,
   * or a body without `code`, whose text is the client's raw request line).
   */
  fallback: string
}

/**
 * Which catalogue entry explains a failure: the error code when the scope
 * knows it, `network` with no answer, `unknown` otherwise (with the server's
 * message as fallback text when it sent one in a `{ message, code }` body
 * below 500). A 429 carries the minutes to wait.
 */
export function failureMessage(
  failure: ApiFailure,
  scope: string,
  knownCodes: readonly string[]
): FailureMessage {
  if (failure.kind === 'network') {
    return { key: `${scope}.errors.network`, params: {}, fallback: failure.message }
  }
  const code = failure.code ?? ''
  if (code && knownCodes.includes(code)) {
    const params: Record<string, string | number> = {}
    if (code === 'E_TOO_MANY_REQUESTS') {
      params['minutes'] = Math.max(1, Math.ceil((failure.retryAfterSeconds ?? 900) / 60))
    }
    return { key: `${scope}.errors.${code}`, params, fallback: failure.message }
  }
  const serverWorded = code !== '' && (failure.status ?? 0) < 500
  return {
    key: `${scope}.errors.unknown`,
    params: {},
    fallback: serverWorded ? failure.message : '',
  }
}
