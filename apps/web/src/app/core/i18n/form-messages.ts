/**
 * Maps a form validation error to the translated message in the `ui` scope.
 * The shape mirrors Signal Forms' `ValidationError` (`kind` plus details)
 * without importing @angular/forms, so mk-field works with any form layer.
 * Pure: no Angular.
 */
export interface FieldError {
  kind: string
  /** A message the validator already produced wins over the catalogue. */
  message?: string
  [detail: string]: unknown
}

/** Error kinds the `ui` catalogue has a message for (`ui.fieldErrors.<kind>`). */
export const KNOWN_FIELD_ERROR_KINDS = [
  'required',
  'minLength',
  'maxLength',
  'min',
  'max',
  'email',
  'pattern',
] as const

/** Translation key of an error; unknown kinds get the generic message. */
export function formMessageKey(error: FieldError): string {
  const known = (KNOWN_FIELD_ERROR_KINDS as readonly string[]).includes(error.kind)
  return `ui.fieldErrors.${known ? error.kind : 'invalid'}`
}

/** Interpolation parameters: the error's own details (`min`, `max`...), scalars only. */
export function formMessageParams(error: FieldError): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(error)) {
    if (
      key !== 'kind' &&
      key !== 'message' &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      params[key] = value
    }
  }
  if (
    error.kind === 'minLength' &&
    params['min'] === undefined &&
    params['minLength'] !== undefined
  ) {
    params['min'] = params['minLength']
  }
  if (
    error.kind === 'maxLength' &&
    params['max'] === undefined &&
    params['maxLength'] !== undefined
  ) {
    params['max'] = params['maxLength']
  }
  return params
}
