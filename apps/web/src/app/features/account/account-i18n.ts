import { provideTranslocoScope } from '@jsverse/transloco'

/** The `account` Transloco scope: profile, password, sessions, export, deletion and sign-out. */
export function provideAccountI18n() {
  return provideTranslocoScope({
    scope: 'account',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}

/** Error codes the `account` catalogue has a message for (`account.errors.<code>`). */
export const ACCOUNT_ERROR_CODES = [
  'E_INVALID_PASSWORD',
  'E_SOLE_OWNER_OF_SHARED_TRIPS',
  'E_TOO_MANY_REQUESTS',
  'E_VALIDATION_ERROR',
  'E_UNAUTHORIZED',
  'E_BAD_CSRF_TOKEN',
] as const
