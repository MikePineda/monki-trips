import type { I18n } from '@adonisjs/i18n'
import { ERROR_CODES, type ErrorCode, type SyncMutationError } from '@monkitrips/shared'
import type { FieldProblem } from '#services/sync/entity_spec'

/**
 * Thrown inside a mutation's transaction to roll it back and answer the
 * mutation with `status: 'rejected'`. Carries the translated error and,
 * when the row exists and the person may see it, the server's row.
 */
export class MutationRejected extends Error {
  constructor(
    readonly error: SyncMutationError,
    readonly row: Record<string, unknown> | null = null
  ) {
    super(error.code)
    this.name = 'MutationRejected'
  }

  /** A business rejection: `{ code, message }` from the shared table and the catalog. */
  static code(i18n: I18n, code: ErrorCode, row: Record<string, unknown> | null = null) {
    if (!(code in ERROR_CODES)) throw new Error(`unknown error code ${code}`)
    return new MutationRejected({ code, message: i18n.t(`errors.${code}`, {}, code) }, row)
  }

  /** A validation rejection with one entry per failing field, worded like the 422 body. */
  static validation(
    i18n: I18n,
    errors: { field: string; rule: string; message: string }[],
    row: Record<string, unknown> | null = null
  ) {
    return new MutationRejected(
      {
        code: 'E_VALIDATION_ERROR',
        message: i18n.t('errors.E_VALIDATION_ERROR', {}, 'E_VALIDATION_ERROR'),
        errors,
      },
      row
    )
  }
}

/** Translates a post-merge problem the way VineJS would word a rule failure. */
export function problemMessage(
  i18n: I18n,
  problem: FieldProblem
): { field: string; rule: string; message: string } {
  const field = i18n.t(`validator.shared.fields.${problem.field}`, {}, problem.field)
  const message = i18n.t(
    `validator.shared.messages.${problem.rule}`,
    { field },
    `${field} failed the ${problem.rule} rule`
  )
  return { field: problem.field, rule: problem.rule, message }
}
