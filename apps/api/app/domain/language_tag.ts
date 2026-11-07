/**
 * BCP 47 language tags as the phrase cards key them: a 2–3 letter language
 * with optional subtags (`ja`, `pt-BR`, `zh-Hant`), canonicalised the way
 * `Intl` does (`PT-br` -> `pt-BR`), so one language has one row per trip.
 * Returns null for anything that is not a well-formed tag.
 */
export const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export function canonicalLanguageTag(value: string): string | null {
  const trimmed = value.trim()
  if (!LANGUAGE_TAG_PATTERN.test(trimmed)) return null
  try {
    const [canonical] = Intl.getCanonicalLocales(trimmed)
    return canonical ?? null
  } catch {
    return null
  }
}

/** The language's name in `inLocale` (`ja` -> `Japanese`), or the tag itself when unknown. */
export function languageDisplayName(tag: string, inLocale: string): string {
  try {
    return new Intl.DisplayNames([inLocale], { type: 'language' }).of(tag) ?? tag
  } catch {
    return tag
  }
}
