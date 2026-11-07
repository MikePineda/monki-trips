import { MINUS, formatMoney } from './money'

describe('formatMoney', () => {
  it('shows the narrow symbol with the decimals of the currency', () => {
    expect(formatMoney(8400, 'EUR', 'en-AU')).toBe('€84.00')
    expect(formatMoney(1240000, 'JPY', 'en-AU')).toMatch(/^¥1,240,000$/)
    expect(formatMoney(13860, 'AUD', 'en-AU')).toBe('$138.60')
  })

  it('uses the true minus sign for a negative amount', () => {
    expect(formatMoney(-1800, 'EUR', 'en-AU')).toBe(`${MINUS}€18.00`)
  })

  it('follows the locale for separators', () => {
    expect(formatMoney(123456, 'EUR', 'es-MX')).toMatch(/1,?234\.56/)
  })
})
