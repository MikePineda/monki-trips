import type { I18n } from '@adonisjs/i18n'
import { MutationRejected, problemMessage } from '#services/sync/mutation_rejected'

/** SQLSTATE codes of a value the database refuses to store (class 22 is "data exception"). */
const INTEGRITY_CODES = new Set(['23502', '23503', '23514'])
const UNIQUE_VIOLATION = '23505'

/**
 * The rejection a mutation answers when its data, not the server, is at
 * fault and the validators did not catch it first: Postgres refusing a
 * duplicate live row (`E_CONFLICT`: a second seat for the same traveller,
 * a share moved onto a traveller who already has one), a value it cannot
 * store (class 22, a NOT NULL, foreign key or CHECK violation) or a value
 * the domain cannot parse (`RangeError`, `SyntaxError`), as
 * `E_VALIDATION_ERROR`. Anything else is a server fault and returns null:
 * the request fails and the client retries the batch later.
 */
export function dataRejection(error: unknown, i18n: I18n): MutationRejected | null {
  if (error instanceof RangeError || error instanceof SyntaxError) return storable(i18n)
  if (typeof error !== 'object' || error === null) return null
  const { code } = error as { code?: unknown }
  if (typeof code !== 'string') return null
  if (code === UNIQUE_VIOLATION) return MutationRejected.code(i18n, 'E_CONFLICT')
  if (code.startsWith('22') || INTEGRITY_CODES.has(code)) return storable(i18n)
  return null
}

function storable(i18n: I18n): MutationRejected {
  return MutationRejected.validation(i18n, [
    problemMessage(i18n, { field: 'changes', rule: 'storable' }),
  ])
}
