import { provideTranslocoScope } from '@jsverse/transloco'

/** The `settings` Transloco scope: language, theme, notifications, install and version copy. */
export function provideSettingsI18n() {
  return provideTranslocoScope({
    scope: 'settings',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}

/** Error codes the `settings` catalogue has a message for (`settings.errors.<code>`). */
export const SETTINGS_ERROR_CODES = [
  'E_PUSH_DISABLED',
  'E_UNAUTHORIZED',
  'E_BAD_CSRF_TOKEN',
  'E_VALIDATION_ERROR',
] as const
