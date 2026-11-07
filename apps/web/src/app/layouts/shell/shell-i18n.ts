import { provideTranslocoScope } from '@jsverse/transloco'

/**
 * The `shell` Transloco scope: the frame and the Phase 0 placeholder pages
 * rendered inside it. Catalogues load with the shell's chunk.
 */
export function provideShellI18n() {
  return provideTranslocoScope({
    scope: 'shell',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}

/**
 * Error codes the shell catalogue explains (`shell.errors.<code>`) for the
 * trip screens it frames: the list, creating a trip, members.
 */
export const TRIP_ERROR_CODES = [
  'E_EMAIL_NOT_VERIFIED',
  'E_VALIDATION_ERROR',
  'E_TOO_MANY_REQUESTS',
  'E_UNAUTHORIZED',
  'E_BAD_CSRF_TOKEN',
] as const
