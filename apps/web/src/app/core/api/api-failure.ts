import type { ValidationErrorItem } from '@monkitrips/shared'

export type ApiFailureKind = 'http' | 'network'

export interface ApiFailureInit {
  kind: ApiFailureKind
  message: string
  status?: number | null
  code?: string | null
  fields?: ValidationErrorItem[]
  details?: Record<string, unknown>
  retryAfterSeconds?: number | null
}

/**
 * What every API call can fail with, in one shape the screens switch on:
 * `code` for a business error (`{ message, code }` bodies, never the text),
 * `fields` for a 422 (`{ errors: [...] }`), `kind: 'network'` when no answer
 * came back. `details` keeps the extra fields some codes add (`tripIds`).
 */
export class ApiFailure extends Error {
  readonly kind: ApiFailureKind
  readonly status: number | null
  readonly code: string | null
  readonly fields: ValidationErrorItem[]
  readonly details: Record<string, unknown>
  readonly retryAfterSeconds: number | null

  constructor(init: ApiFailureInit) {
    super(init.message)
    this.name = 'ApiFailure'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? null
    this.fields = init.fields ?? []
    this.details = init.details ?? {}
    this.retryAfterSeconds = init.retryAfterSeconds ?? null
  }

  is(code: string): boolean {
    return this.code === code
  }

  isStatus(status: number): boolean {
    return this.status === status
  }

  /** The first validation message of a field, when the server rejected it. */
  fieldMessage(field: string): string | undefined {
    return this.fields.find((item) => item.field === field)?.message
  }
}

/** The subset of a Tuyau error the mapper reads (structural, so specs need no ky). */
interface TuyauLikeError {
  kind: 'http' | 'network'
  status?: number
  response?: unknown
  rawResponse?: { headers: { get(name: string): string | null } }
  message?: string
}

function isTuyauLike(error: unknown): error is TuyauLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    ((error as { kind: unknown }).kind === 'http' ||
      (error as { kind: unknown }).kind === 'network')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidationItem(value: unknown): value is ValidationErrorItem {
  return (
    isRecord(value) && typeof value['field'] === 'string' && typeof value['message'] === 'string'
  )
}

/** Normalises anything a call can throw into an ApiFailure (an ApiFailure passes through). */
export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiFailure) {
    return error
  }
  if (!isTuyauLike(error)) {
    return new ApiFailure({
      kind: 'network',
      message: error instanceof Error ? error.message : 'Request failed before an answer came back',
    })
  }
  if (error.kind === 'network') {
    return new ApiFailure({ kind: 'network', message: error.message ?? 'Network error' })
  }
  const status = error.status ?? null
  const body = error.response
  const retryAfter = error.rawResponse?.headers.get('Retry-After')
  const retryAfterSeconds =
    retryAfter !== null && retryAfter !== undefined ? Number(retryAfter) : NaN

  if (isRecord(body) && Array.isArray(body['errors'])) {
    const fields = body['errors'].filter(isValidationItem)
    return new ApiFailure({
      kind: 'http',
      status,
      code: 'E_VALIDATION_ERROR',
      message: fields[0]?.message ?? 'Some fields are not valid',
      fields,
    })
  }
  if (isRecord(body) && typeof body['code'] === 'string') {
    const { message, code, ...details } = body
    return new ApiFailure({
      kind: 'http',
      status,
      code,
      message: typeof message === 'string' ? message : code,
      details,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
    })
  }
  return new ApiFailure({
    kind: 'http',
    status,
    code: status === 429 ? 'E_TOO_MANY_REQUESTS' : null,
    message: error.message ?? `Request failed with status ${status ?? 'unknown'}`,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
  })
}

/** Runs one request and rethrows whatever it fails with as an ApiFailure. */
export async function apiCall<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request()
  } catch (error) {
    throw toApiFailure(error)
  }
}
