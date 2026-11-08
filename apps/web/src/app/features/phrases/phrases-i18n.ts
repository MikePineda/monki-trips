import { provideTranslocoScope } from '@jsverse/transloco'

/** The `phrases` Transloco scope: the phrase cards list, generation and show mode. */
export function providePhrasesI18n() {
  return provideTranslocoScope({
    scope: 'phrases',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
