import type { Translation } from '@jsverse/transloco'
import shellEn from '../app/layouts/shell/i18n/en.json'
import shellEs from '../app/layouts/shell/i18n/es.json'
import type { AppLang } from '../app/domain/locale'

/**
 * Both catalogues of every Transloco scope in the app, keyed by the scope
 * name its provideTranslocoScope() declares. i18nTesting() preloads all of
 * them before the first render, so no spec races a scope's lazy import().
 * A new scope goes here too: i18n-testing.spec.ts fails until it does.
 */
export const SCOPE_CATALOGUES = {
  shell: { en: shellEn, es: shellEs },
} satisfies Record<string, Record<AppLang, Translation>>

/** Every scope catalogue keyed like a Transloco path (`'shell/es'`). */
export function scopeCataloguesByPath(): Record<string, Translation> {
  return Object.fromEntries(
    Object.entries(SCOPE_CATALOGUES).flatMap(([scope, catalogues]) =>
      Object.entries(catalogues).map(([lang, catalogue]) => [`${scope}/${lang}`, catalogue])
    )
  )
}
