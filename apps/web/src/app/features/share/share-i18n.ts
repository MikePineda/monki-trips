import { provideTranslocoScope } from '@jsverse/transloco'

/** The `share` Transloco scope: the Share Target inbox (`/share`). */
export function provideShareI18n() {
  return provideTranslocoScope({
    scope: 'share',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
