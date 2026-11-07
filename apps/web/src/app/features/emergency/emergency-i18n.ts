import { provideTranslocoScope } from '@jsverse/transloco'

/** The `emergency` Transloco scope: the one-handed read view and the form behind it. */
export function provideEmergencyI18n() {
  return provideTranslocoScope({
    scope: 'emergency',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
