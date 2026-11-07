/**
 * Language tags as the phrase cards key them: a 2–3 letter language, an
 * optional 4-letter script and an optional region (`ja`, `pt-BR`,
 * `zh-Hant`, `zh-Hant-TW`, `es-419`), canonicalised the way `Intl` does
 * (`PT-br` -> `pt-BR`), so one language has one row per trip. Variants,
 * extensions and private-use subtags are refused: each would be another
 * spelling of the same language and defeat "once per language". Returns
 * null for anything else.
 */
export const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|\d{3}))?$/

export function canonicalLanguageTag(value: string): string | null {
  const trimmed = value.trim()
  if (!LANGUAGE_TAG_PATTERN.test(trimmed)) return null
  try {
    const [canonical] = Intl.getCanonicalLocales(trimmed)
    return canonical && LANGUAGE_TAG_PATTERN.test(canonical) ? canonical : null
  } catch {
    return null
  }
}

/** The canonical tag when it is one of `supported` (compared canonically), else null. */
export function supportedLanguageTag(value: string, supported: readonly string[]): string | null {
  const tag = canonicalLanguageTag(value)
  if (!tag) return null
  return supported.some((entry) => canonicalLanguageTag(entry) === tag) ? tag : null
}

/** The language's name in `inLocale` (`ja` -> `Japanese`), or the tag itself when unknown. */
export function languageDisplayName(tag: string, inLocale: string): string {
  try {
    return new Intl.DisplayNames([inLocale], { type: 'language' }).of(tag) ?? tag
  } catch {
    return tag
  }
}
