import { provideTranslocoScope } from '@jsverse/transloco'

/** The `activity` Transloco scope: the trip's activity feed. */
export function provideActivityI18n() {
  return provideTranslocoScope({
    scope: 'activity',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}

/** Error codes the `activity` catalogue has a message for (`activity.errors.<code>`). */
export const ACTIVITY_ERROR_CODES = [
  'E_ROUTE_NOT_FOUND',
  'E_EMAIL_NOT_VERIFIED',
  'E_TOO_MANY_REQUESTS',
  'E_UNAUTHORIZED',
] as const
