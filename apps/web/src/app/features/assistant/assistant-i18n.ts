import { provideTranslocoScope } from '@jsverse/transloco'

/** The `assistant` Transloco scope: Kiko's chat, its proposals and its limits. */
export function provideAssistantI18n() {
  return provideTranslocoScope({
    scope: 'assistant',
    loader: {
      en: () => import('./i18n/en.json'),
      es: () => import('./i18n/es.json'),
    },
  })
}
