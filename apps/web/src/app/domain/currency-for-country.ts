/**
 * The currency people pay with in a country (ISO 3166-1 alpha-2 → ISO 4217),
 * for the quick expense's default: a stop in Japan preselects JPY. The
 * table covers the countries a trip commonly passes through; a country it
 * does not know (synthetic fixtures use `XA`-style codes) answers null and
 * the caller falls back to the trip's base currency. Pure.
 */
const EURO_COUNTRIES = [
  'AD',
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MC',
  'ME',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
  'SM',
  'VA',
  'XK',
] as const

const CURRENCY_BY_COUNTRY: Readonly<Record<string, string>> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((country) => [country, 'EUR'])),
  AE: 'AED',
  AR: 'ARS',
  AU: 'AUD',
  BD: 'BDT',
  BG: 'BGN',
  BO: 'BOB',
  BR: 'BRL',
  CA: 'CAD',
  CH: 'CHF',
  CL: 'CLP',
  CN: 'CNY',
  CO: 'COP',
  CR: 'CRC',
  CU: 'CUP',
  CZ: 'CZK',
  DK: 'DKK',
  DO: 'DOP',
  EC: 'USD',
  EG: 'EGP',
  GB: 'GBP',
  GE: 'GEL',
  GT: 'GTQ',
  HK: 'HKD',
  HU: 'HUF',
  ID: 'IDR',
  IL: 'ILS',
  IN: 'INR',
  IS: 'ISK',
  JO: 'JOD',
  JP: 'JPY',
  KE: 'KES',
  KH: 'KHR',
  KR: 'KRW',
  KW: 'KWD',
  LA: 'LAK',
  LK: 'LKR',
  MA: 'MAD',
  MN: 'MNT',
  MX: 'MXN',
  MY: 'MYR',
  NO: 'NOK',
  NP: 'NPR',
  NZ: 'NZD',
  PA: 'PAB',
  PE: 'PEN',
  PH: 'PHP',
  PL: 'PLN',
  QA: 'QAR',
  RO: 'RON',
  RS: 'RSD',
  SA: 'SAR',
  SE: 'SEK',
  SG: 'SGD',
  TH: 'THB',
  TR: 'TRY',
  TW: 'TWD',
  TZ: 'TZS',
  UA: 'UAH',
  US: 'USD',
  UY: 'UYU',
  VN: 'VND',
  ZA: 'ZAR',
}

/** The currency of a country, or null when the table does not know it. */
export function currencyForCountry(countryCode: string | null | undefined): string | null {
  if (!countryCode) {
    return null
  }
  return CURRENCY_BY_COUNTRY[countryCode.trim().toUpperCase()] ?? null
}

/** Every currency the table knows, sorted, for the currency pickers. */
export const KNOWN_CURRENCIES: readonly string[] = [
  ...new Set(Object.values(CURRENCY_BY_COUNTRY)),
].sort()
