import { provideTranslocoScope } from '@jsverse/transloco'

/** The `trip` Transloco scope: the trip summary, editing the trip and its stops. */
export function provideTripI18n() {
  return provideTranslocoScope({
    scope: 'trip',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
