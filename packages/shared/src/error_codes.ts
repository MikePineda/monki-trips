/**
 * Error codes the API answers with, and their HTTP status. The web app
 * switches on the code, never on the message (which is localized). Each code
 * has a message in `apps/api/resources/lang/<locale>/errors.json`; a unit
 * test on the API side keeps the catalogs in step with this table.
 */
export const ERROR_CODES = {
  // Framework-level
  E_ROUTE_NOT_FOUND: 404,
  E_ROW_NOT_FOUND: 404,
  E_BAD_REQUEST: 400,
  E_VALIDATION_ERROR: 422,
  E_BAD_CSRF_TOKEN: 403,
  E_TOO_MANY_REQUESTS: 429,
  /** A write lost a race on a unique key (the same thing was created twice at once). */
  E_CONFLICT: 409,
  E_INTERNAL_SERVER_ERROR: 500,

  // Auth and account
  E_UNAUTHORIZED: 401,
  E_INVALID_CREDENTIALS: 401,
  E_ACCOUNT_DISABLED: 403,
  E_REGISTRATION_CLOSED: 403,
  E_EMAIL_TAKEN: 409,
  E_EMAIL_NOT_VERIFIED: 403,
  E_EMAIL_ALREADY_VERIFIED: 409,
  E_TOKEN_EXPIRED: 410,
  E_INVALID_CODE: 400,
  E_INVALID_PASSWORD: 403,
  E_SOLE_OWNER_OF_SHARED_TRIPS: 409,
  E_DELETION_NOT_SCHEDULED: 409,

  // Trips and members
  E_TRIP_ROLE: 403,
  E_OWNER_CANNOT_LEAVE: 409,
  E_BASE_CURRENCY_LOCKED: 409,
  E_NOT_A_MEMBER: 404,

  // Invitations
  E_INVITATION_EXPIRED: 410,
  E_INVITATION_EMAIL_MISMATCH: 403,

  // Notifications
  /** The server has no VAPID keys: nothing can be sent. */
  E_PUSH_DISABLED: 409,

  // Sync
  /** The pull cursor is older than the purge horizon: clear the cache and pull again without one. */
  E_SYNC_CURSOR_EXPIRED: 410,
  /** The row was deleted; a tombstone always wins over a later edit. */
  E_ROW_DELETED: 410,

  // Documents
  E_FILE_TOO_LARGE: 413,
  E_UNSUPPORTED_FILE: 415,
  E_STORAGE_UNAVAILABLE: 503,

  // Exchange rates
  E_FX_UNAVAILABLE: 503,

  // LLM
  /** The account spent its monthly token cap; the payload says when it resets. */
  E_LLM_QUOTA_EXCEEDED: 402,
  /** The model provider could not answer (network, upstream error, not configured). */
  E_LLM_UNAVAILABLE: 503,
  /** The model answered twice with something the schema refuses. */
  E_LLM_BAD_OUTPUT: 422,
} as const

export type ErrorCode = keyof typeof ERROR_CODES
