import { provideTranslocoScope } from '@jsverse/transloco'

/** The `tasks` Transloco scope: tasks by urgency, the edit sheet and the pre-trip checklist. */
export function provideTasksI18n() {
  return provideTranslocoScope({
    scope: 'tasks',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
