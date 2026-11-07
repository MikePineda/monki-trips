import { currencyForCountry } from './currency-for-country'

describe('currencyForCountry', () => {
  it('maps a country to the currency people pay with there', () => {
    expect(currencyForCountry('JP')).toBe('JPY')
    expect(currencyForCountry('TH')).toBe('THB')
    expect(currencyForCountry('AU')).toBe('AUD')
    expect(currencyForCountry('FR')).toBe('EUR')
  })

  it('takes the code in any case and with spaces around it', () => {
    expect(currencyForCountry('jp')).toBe('JPY')
    expect(currencyForCountry(' es ')).toBe('EUR')
  })

  it('answers null for a country it does not know, so synthetic fixtures fall back to the base currency', () => {
    expect(currencyForCountry('XA')).toBeNull()
    expect(currencyForCountry('')).toBeNull()
    expect(currencyForCountry(null)).toBeNull()
    expect(currencyForCountry(undefined)).toBeNull()
  })
})
