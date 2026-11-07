import { Exception } from '@adonisjs/core/exceptions'
import { ERROR_CODES, type ErrorCode } from '@monkitrips/shared'

/**
 * A business error the API answers with `{ message, code, ...payload }`. The
 * status comes from the shared code table, so the web app and the API never
 * disagree; the message is translated from `errors.<code>` by the handler.
 * `payload` carries the extra fields some codes define (`tripIds`).
 */
export class ApiException extends Exception {
  readonly payload: Record<string, unknown>

  constructor(code: ErrorCode, payload: Record<string, unknown> = {}) {
    super(code, { code, status: ERROR_CODES[code] })
    this.payload = payload
  }
}
