import { DEFAULT_LOCALE, LOCALES, type Locale } from '@monkitrips/shared'

/**
 * UI languages and the locale each one formats with. Pure: no Angular.
 * Adding a language is one entry in @monkitrips/shared plus its catalogues.
 */
export const APP_LANGS = LOCALES

export type AppLang = Locale

/** English unless the device or the person picks Spanish. */
export const DEFAULT_LANG: AppLang = DEFAULT_LOCALE

const FORMAT_LOCALE: Record<AppLang, string> = {
  en: 'en-AU',
  es: 'es-MX',
}

/** The BCP 47 locale `Intl` formats a language with. */
export function formatLocaleFor(lang: AppLang): string {
  return FORMAT_LOCALE[lang]
}

export function isAppLang(value: unknown): value is AppLang {
  return typeof value === 'string' && (APP_LANGS as readonly string[]).includes(value)
}
