import type { Translation } from '@jsverse/transloco'
import offlineEn from '../app/features/offline/i18n/en.json'
import offlineEs from '../app/features/offline/i18n/es.json'
import settingsEn from '../app/features/settings/i18n/en.json'
import settingsEs from '../app/features/settings/i18n/es.json'
import shellEn from '../app/layouts/shell/i18n/en.json'
import shellEs from '../app/layouts/shell/i18n/es.json'
import uiEn from '../app/shared/ui/i18n/en.json'
import uiEs from '../app/shared/ui/i18n/es.json'
import type { AppLang } from '../app/domain/locale'

/**
 * Both catalogues of every Transloco scope in the app, keyed by the scope
 * name its provideTranslocoScope() declares. i18nTesting() preloads all of
 * them before the first render, so no spec races a scope's lazy import().
 * A new scope goes here too: i18n-testing.spec.ts fails until it does.
 */
export const SCOPE_CATALOGUES = {
  offline: { en: offlineEn, es: offlineEs },
  settings: { en: settingsEn, es: settingsEs },
  shell: { en: shellEn, es: shellEs },
  ui: { en: uiEn, es: uiEs },
} satisfies Record<string, Record<AppLang, Translation>>

/** Every scope catalogue keyed like a Transloco path (`'shell/es'`). */
export function scopeCataloguesByPath(): Record<string, Translation> {
  return Object.fromEntries(
    Object.entries(SCOPE_CATALOGUES).flatMap(([scope, catalogues]) =>
      Object.entries(catalogues).map(([lang, catalogue]) => [`${scope}/${lang}`, catalogue])
    )
  )
}
