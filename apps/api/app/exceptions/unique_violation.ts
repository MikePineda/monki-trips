/** Postgres SQLSTATE for a unique or primary-key violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * Whether `error` is Postgres refusing a duplicate key, optionally on one
 * named constraint. Two requests that create the same thing at once both
 * pass their "does it exist?" check; the database is the only referee, and
 * this is how callers recognise its answer.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { code, constraint: name } = error as { code?: unknown; constraint?: unknown }
  return code === UNIQUE_VIOLATION && (constraint === undefined || name === constraint)
}

/** Unique constraints whose violation has its own error code; any other answers `E_CONFLICT`. */
export const UNIQUE_VIOLATION_CODES = {
  users_email_unique: 'E_EMAIL_TAKEN',
} as const

/** The error code a unique violation answers with. */
export function uniqueViolationCode(error: unknown): 'E_EMAIL_TAKEN' | 'E_CONFLICT' {
  const { constraint } = error as { constraint?: string }
  return UNIQUE_VIOLATION_CODES[constraint as keyof typeof UNIQUE_VIOLATION_CODES] ?? 'E_CONFLICT'
}
