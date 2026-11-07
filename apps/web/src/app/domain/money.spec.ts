import { MINUS, formatMoney, keypadToMinor, minorToKeypad, mixesCurrencies } from './money'

describe('formatMoney', () => {
  it('shows the narrow symbol with the decimals of the currency', () => {
    expect(formatMoney(8400, 'EUR', 'en-AU')).toBe('€84.00')
    expect(formatMoney(1240000, 'JPY', 'en-AU')).toMatch(/^¥1,240,000$/)
    expect(formatMoney(13860, 'AUD', 'en-AU')).toBe('$138.60')
  })

  it('zero-decimal currency renders without decimals', () => {
    expect(formatMoney(1500, 'JPY', 'en-AU')).toBe('¥1,500')
    expect(formatMoney(250, 'KRW', 'en-AU')).toBe('₩250')
    expect(formatMoney(1234n, 'JPY', 'es-MX')).toMatch(/^¥1,?234$/)
  })

  it('uses the true minus sign for a negative amount', () => {
    expect(formatMoney(-1800, 'EUR', 'en-AU')).toBe(`${MINUS}€18.00`)
    expect(formatMoney(-50, 'JPY', 'en-AU')).toBe(`${MINUS}¥50`)
  })

  it('follows the locale for separators', () => {
    expect(formatMoney(123456, 'EUR', 'es-MX')).toMatch(/1,?234\.56/)
  })

  it('mixed currencies disambiguate the base symbol', () => {
    expect(formatMoney(13860, 'AUD', 'en-AU', { disambiguate: true })).toBe('A$138.60')
    expect(formatMoney(1500, 'JPY', 'en-AU', { disambiguate: true })).toBe('JP¥1,500')
    expect(formatMoney(-1200, 'USD', 'en-AU', { disambiguate: true })).toBe(`${MINUS}US$12.00`)
    // A symbol of its own needs no prefix.
    expect(formatMoney(8400, 'EUR', 'en-AU', { disambiguate: true })).toBe('€84.00')
    expect(formatMoney(8400, 'THB', 'en-AU', { disambiguate: true })).toBe('฿84.00')
  })

  it('mixesCurrencies is true as soon as one amount is not in the base currency', () => {
    expect(mixesCurrencies('AUD', ['AUD', 'aud'])).toBe(false)
    expect(mixesCurrencies('AUD', [])).toBe(false)
    expect(mixesCurrencies('AUD', ['AUD', 'THB'])).toBe(true)
  })
})

describe('keypadToMinor', () => {
  it('turns keypad digits into minor units of the currency', () => {
    expect(keypadToMinor('12.5', 'EUR')).toBe(1250)
    expect(keypadToMinor('12', 'EUR')).toBe(1200)
    expect(keypadToMinor('0.05', 'EUR')).toBe(5)
    expect(keypadToMinor('12.', 'EUR')).toBe(1200)
  })

  it('drops the fraction of a zero-decimal currency and keeps three decimals', () => {
    expect(keypadToMinor('1500.9', 'JPY')).toBe(1500)
    expect(keypadToMinor('1.5', 'KWD')).toBe(1500)
  })

  it('answers null for nothing typed or junk', () => {
    expect(keypadToMinor('', 'EUR')).toBeNull()
    expect(keypadToMinor('.', 'EUR')).toBeNull()
    expect(keypadToMinor('abc', 'EUR')).toBeNull()
  })
})

describe('minorToKeypad', () => {
  it('writes minor units back as keypad digits', () => {
    expect(minorToKeypad(1250, 'EUR')).toBe('12.50')
    expect(minorToKeypad(5, 'EUR')).toBe('0.05')
    expect(minorToKeypad(1500, 'JPY')).toBe('1500')
    expect(minorToKeypad(-1250, 'EUR')).toBe('12.50')
    expect(keypadToMinor(minorToKeypad(98765, 'EUR'), 'EUR')).toBe(98765)
  })
})
