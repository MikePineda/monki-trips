import { provideTranslocoScope } from '@jsverse/transloco'

/** The `history` Transloco scope: the trip list as a travel history. */
export function provideHistoryI18n() {
  return provideTranslocoScope({
    scope: 'history',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
