import { provideTranslocoScope } from '@jsverse/transloco'

/** The `plan` Transloco scope: the Days list and Where we sleep. */
export function providePlanI18n() {
  return provideTranslocoScope({
    scope: 'plan',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
