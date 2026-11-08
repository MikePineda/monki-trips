import { formatMonthYear } from './month-year'

describe('formatMonthYear', () => {
  it('names the month of a date with its year, never as YYYY-MM', () => {
    expect(formatMonthYear('2026-10-27', 'en-AU')).toBe('Oct 2026')
    expect(formatMonthYear('2026-10-27', 'es-MX')).toBe('oct 2026')
  })
})
