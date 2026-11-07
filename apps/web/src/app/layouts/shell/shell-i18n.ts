import { provideTranslocoScope } from '@jsverse/transloco'

/**
 * The `shell` Transloco scope: the frame and the Phase 0 placeholder pages
 * rendered inside it. Catalogues load with the shell's chunk.
 */
export function provideShellI18n() {
  return provideTranslocoScope({
    scope: 'shell',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
