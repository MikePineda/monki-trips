/**
 * Locales the product speaks, on the API (error messages, mails) and in the
 * web app. English is the default and the fallback; adding a language is one
 * entry here plus its catalogs on both sides.
 */
export const LOCALES = ['en', 'es'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
