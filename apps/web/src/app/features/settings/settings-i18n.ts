import { provideTranslocoScope } from '@jsverse/transloco'

/** The `settings` Transloco scope: language, theme, install and version copy. */
export function provideSettingsI18n() {
  return provideTranslocoScope({
    scope: 'settings',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
