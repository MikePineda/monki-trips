/**
 * ISO 4217 minor-unit exponents: how many decimal places a currency's minor
 * unit has (JPY 0, THB 2, KWD 3). Money is stored as integer minor units
 * (`*Minor`), so every conversion between a display amount and a stored one
 * goes through this table. Pure: no I/O, no framework.
 */

/** Exponent assumed for a code that is not in the table. */
export const DEFAULT_MINOR_UNIT_EXPONENT = 2

/** Active ISO 4217 codes whose exponent is not 2. */
const NON_DEFAULT_EXPONENTS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4,
}

/** Active ISO 4217 codes with the default exponent of 2. */
const TWO_DECIMAL_CODES = new Set(
  (
    'AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BGN BMD BND BOB BOV BRL BSD BTN ' +
    'BWP BYN BZD CAD CDF CHE CHF CHW CNY COP COU CRC CUP CVE CZK DKK DOP DZD EGP ERN ' +
    'ETB EUR FJD FKP GBP GEL GHS GIP GMD GTQ GYD HKD HNL HTG HUF IDR ILS INR IRR JMD ' +
    'KES KGS KHR KPW KYD KZT LAK LBP LKR LRD LSL MAD MDL MGA MKD MMK MNT MOP MRU MUR ' +
    'MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR RON ' +
    'RSD RUB SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT ' +
    'TOP TRY TTD TWD TZS UAH USD USN UYU UZS VED VES WST XCD XCG YER ZAR ZMW ZWG'
  ).split(' ')
)

export interface MinorUnitExponent {
  /** Decimal places of the minor unit. */
  exponent: number
  /** False when the code is not an active ISO 4217 currency (the exponent is then a guess). */
  known: boolean
}

/**
 * The minor-unit exponent of a currency code. Unknown or malformed codes get
 * the default of 2 and `known: false`, so callers can flag the value instead
 * of silently trusting it.
 */
export function minorUnitExponent(code: string): MinorUnitExponent {
  const normalized = code.trim().toUpperCase()
  const exponent = NON_DEFAULT_EXPONENTS[normalized]
  if (exponent !== undefined) {
    return { exponent, known: true }
  }
  return { exponent: DEFAULT_MINOR_UNIT_EXPONENT, known: TWO_DECIMAL_CODES.has(normalized) }
}
