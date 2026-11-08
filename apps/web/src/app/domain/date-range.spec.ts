import { formatDateRange } from './date-range'

describe('formatDateRange', () => {
  it('writes a trip across two months with one year at the end', () => {
    expect(formatDateRange('2026-10-27', '2026-11-05', 'en-AU')).toBe('27 Oct – 5 Nov 2026')
    expect(formatDateRange('2026-10-27', '2026-11-05', 'es-MX')).toBe('27 oct – 5 nov 2026')
  })

  it('names the month once when the trip stays in it', () => {
    expect(formatDateRange('2026-11-03', '2026-11-09', 'en-AU')).toBe('3 – 9 Nov 2026')
    expect(formatDateRange('2026-11-03', '2026-11-09', 'es-MX')).toBe('3 – 9 nov 2026')
  })

  it('writes both years when the trip crosses New Year, and one date for a day trip', () => {
    expect(formatDateRange('2026-12-28', '2027-01-03', 'en-AU')).toBe('28 Dec 2026 – 3 Jan 2027')
    expect(formatDateRange('2026-11-05', '2026-11-05', 'en-AU')).toBe('5 Nov 2026')
  })

  it('never shows the raw ISO dates', () => {
    expect(formatDateRange('2027-03-01', '2027-03-10', 'en-AU')).not.toMatch(/\d{4}-\d{2}/)
  })
})
