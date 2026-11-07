import { provideTranslocoScope } from '@jsverse/transloco'

/** The `offline` Transloco scope: the "Ready to fly" page and its states. */
export function provideOfflineI18n() {
  return provideTranslocoScope({
    scope: 'offline',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
