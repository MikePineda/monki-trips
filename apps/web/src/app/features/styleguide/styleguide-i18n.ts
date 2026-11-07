import { provideTranslocoScope } from '@jsverse/transloco'

/** The `styleguide` Transloco scope: the style guide's own copy, loaded with its chunk. */
export function provideStyleguideI18n() {
  return provideTranslocoScope({
    scope: 'styleguide',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
