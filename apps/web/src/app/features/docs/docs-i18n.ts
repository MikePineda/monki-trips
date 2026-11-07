import { provideTranslocoScope } from '@jsverse/transloco'

/** The `docs` Transloco scope: the documents list, the upload sheet and the detail sheet. */
export function provideDocsI18n() {
  return provideTranslocoScope({
    scope: 'docs',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
