import { sortedStops } from '@monkitrips/shared'

/**
 * The languages the API generates phrase cards in, as canonical tags. A
 * copy of `PHRASE_CARD_LANGUAGES` in the API's `config/llm.ts` (the API
 * answers 422 for anything else); keep the two lists equal.
 */
export const PHRASE_CARD_LANGUAGES: readonly string[] = [
  'th',
  'ja',
  'ko',
  'zh-Hans',
  'zh-Hant',
  'vi',
  'id',
  'ms',
  'fr',
  'de',
  'it',
  'es',
  'pt',
  'pt-BR',
  'en',
  'km',
  'lo',
  'my',
]

/** The language a traveller most likely needs in a country (ISO 3166-1 alpha-2), among the supported ones. */
const COUNTRY_LANGUAGES: Readonly<Record<string, string>> = {
  TH: 'th',
  JP: 'ja',
  KR: 'ko',
  CN: 'zh-Hans',
  SG: 'zh-Hans',
  TW: 'zh-Hant',
  HK: 'zh-Hant',
  MO: 'zh-Hant',
  VN: 'vi',
  ID: 'id',
  MY: 'ms',
  BN: 'ms',
  FR: 'fr',
  BE: 'fr',
  MC: 'fr',
  LU: 'fr',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  LI: 'de',
  IT: 'it',
  SM: 'it',
  VA: 'it',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CL: 'es',
  CO: 'es',
  PE: 'es',
  UY: 'es',
  CR: 'es',
  CU: 'es',
  DO: 'es',
  EC: 'es',
  GT: 'es',
  PA: 'es',
  PT: 'pt',
  AO: 'pt',
  MZ: 'pt',
  BR: 'pt-BR',
  GB: 'en',
  IE: 'en',
  US: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  KH: 'km',
  LA: 'lo',
  MM: 'my',
}

/** The supported card language of a country, or null when none fits. */
export function languageForCountry(countryCode: string | null | undefined): string | null {
  return countryCode ? (COUNTRY_LANGUAGES[countryCode.toUpperCase()] ?? null) : null
}

/**
 * The language to preselect: the first stop (in trip order) whose country
 * has a supported language that is not the traveller's own; then any stop's
 * language; null when the trip has no stop with a known country. Pure.
 */
export function destinationLanguage(
  stops: readonly { position: number; countryCode: string | null }[],
  ownLanguage: string
): string | null {
  const languages = sortedStops(stops)
    .map((stop) => languageForCountry(stop.countryCode))
    .filter((language): language is string => language !== null)
  const own = ownLanguage.toLowerCase().split('-')[0]
  return (
    languages.find((language) => language.toLowerCase().split('-')[0] !== own) ??
    languages[0] ??
    null
  )
}
