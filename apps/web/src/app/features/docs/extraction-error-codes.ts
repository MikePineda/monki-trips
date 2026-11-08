/** Codes the `docs.errors` catalogue explains for reading a booking; anything else is `unknown`. */
export const EXTRACTION_ERROR_CODES = [
  'E_EXTRACTION_UNAVAILABLE',
  'E_LLM_UNAVAILABLE',
  'E_LLM_QUOTA_EXCEEDED',
  'E_TOO_MANY_REQUESTS',
  'E_LLM_BAD_OUTPUT',
  'E_UNSUPPORTED_FILE',
  'E_FILE_TOO_LARGE',
  'E_ROW_NOT_FOUND',
  'E_AI_ACTION_STALE',
  'E_AI_ACTION_CLOSED',
  'E_AI_ACTION_NOT_REVISABLE',
  'E_VALIDATION_ERROR',
] as const
