import { provideTranslocoScope } from '@jsverse/transloco'

/**
 * The `ui` Transloco scope: the ui-kit's own copy (close, undo, loading,
 * field errors, connection states). Every mk- component that renders text
 * provides it, so a consumer never has to, and always in `viewProviders`:
 * as `providers` it would also become the scope of the consumer's own copy
 * projected into the component or bound to its inputs, which then waits
 * for the wrong catalogue and keeps the old language when the consumer's
 * scope loads later.
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
