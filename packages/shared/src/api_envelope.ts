/**
 * Response envelopes of the API. Every success answers `{ data }`; lists
 * that page add `metadata`. Every failure answers `{ message, code }` with
 * the message in the request's locale, except validation (422) which lists
 * the failing fields.
 */
export interface ApiEnvelope<T, M = undefined> {
  data: T
  metadata?: M
}

export interface ApiErrorBody {
  message: string
  code: string
}

export interface ValidationErrorItem {
  field: string
  rule: string
  message: string
}

export interface ValidationErrorBody {
  errors: ValidationErrorItem[]
}
