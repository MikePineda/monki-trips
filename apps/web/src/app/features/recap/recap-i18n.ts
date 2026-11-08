import { provideTranslocoScope } from '@jsverse/transloco'

/** The `recap` Transloco scope: the trip in numbers, its stamps, its money and the share image. */
export function provideRecapI18n() {
  return provideTranslocoScope({
    scope: 'recap',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
