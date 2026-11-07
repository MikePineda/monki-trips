import { provideTranslocoScope } from '@jsverse/transloco'

/** The `today` Transloco scope: the Today screen. */
export function provideTodayI18n() {
  return provideTranslocoScope({
    scope: 'today',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
