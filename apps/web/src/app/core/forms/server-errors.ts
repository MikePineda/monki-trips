import type { FieldTree, ValidationError } from '@angular/forms/signals'
import type { ApiFailure } from '../../core/api/api-failure'

/**
 * Turns the field errors of a 422 into Signal Forms submit errors on the
 * matching fields, so the server's message shows under the input it
 * belongs to. Fields the form does not have are left to the form-level
 * message.
 */
export function serverFieldErrors<TModel extends object>(
  failure: ApiFailure,
  form: FieldTree<TModel>
): ValidationError.WithFieldTree[] {
  const fields = form as unknown as Record<string, FieldTree<unknown> | undefined>
  const errors: ValidationError.WithFieldTree[] = []
  for (const item of failure.fields) {
    const field = fields[item.field]
    if (typeof field === 'function') {
      errors.push({ kind: 'server', message: item.message, fieldTree: field })
    }
  }
  return errors
}
