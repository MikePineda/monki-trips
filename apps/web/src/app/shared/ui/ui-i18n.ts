import { provideTranslocoScope } from '@jsverse/transloco'

/**
 * The `ui` Transloco scope: the ui-kit's own copy (close, undo, loading,
 * field errors, connection states). Every mk- component that renders text
 * provides it, so a consumer never has to.
 */
export function provideUiI18n() {
  return provideTranslocoScope({
    scope: 'ui',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
