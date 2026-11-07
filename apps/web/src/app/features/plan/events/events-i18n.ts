import { provideTranslocoScope } from '@jsverse/transloco'

/** The `events` Transloco scope: event kinds and statuses, the detail sheet and the form. */
export function provideEventsI18n() {
  return provideTranslocoScope({
    scope: 'events',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
