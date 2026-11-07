import { provideTranslocoScope } from '@jsverse/transloco'

/** The `auth` Transloco scope: sign-in, sign-up, invitations, verification and password reset. */
export function provideAuthI18n() {
  return provideTranslocoScope({
    scope: 'auth',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}

/** Error codes the `auth` catalogue has a message for (`auth.errors.<code>`). */
export const AUTH_ERROR_CODES = [
  'E_INVALID_CREDENTIALS',
  'E_ACCOUNT_DISABLED',
  'E_TOO_MANY_REQUESTS',
  'E_REGISTRATION_CLOSED',
  'E_EMAIL_TAKEN',
  'E_TOKEN_EXPIRED',
  'E_INVALID_CODE',
  'E_EMAIL_ALREADY_VERIFIED',
  'E_INVITATION_EXPIRED',
  'E_INVITATION_EMAIL_MISMATCH',
  'E_EMAIL_NOT_VERIFIED',
  'E_VALIDATION_ERROR',
  'E_BAD_CSRF_TOKEN',
  'E_UNAUTHORIZED',
] as const
