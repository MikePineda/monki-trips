import { provideTranslocoScope } from '@jsverse/transloco'

/** The `passport` Transloco scope: the stamps of every place and the map of where we have been. */
export function providePassportI18n() {
  return provideTranslocoScope({
    scope: 'passport',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
