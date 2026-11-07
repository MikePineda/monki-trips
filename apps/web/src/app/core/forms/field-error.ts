import type { FieldTree } from '@angular/forms/signals'
import type { FieldError } from '../i18n/form-messages'

/** Properties of a Signal Forms error that point back at the form, not at the message. */
const FORM_REFERENCES = new Set(['fieldTree', 'formField'])

/**
 * The first error of a Signal Forms field, once the person has touched it,
 * in the plain shape mk-field translates (`kind` plus details). Null while
 * the field is untouched or valid, so a form never shouts before anyone
 * typed.
 */
export function fieldError(field: FieldTree<unknown>): FieldError | null {
  const state = field()
  if (!state.touched()) {
    return null
  }
  const first = state.errors()[0]
  if (!first) {
    return null
  }
  const plain: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(first)) {
    if (!FORM_REFERENCES.has(key)) {
      plain[key] = value
    }
  }
  return plain as FieldError
}
