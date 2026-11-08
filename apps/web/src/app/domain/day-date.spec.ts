import { formatDayDate } from './day-date'

describe('formatDayDate', () => {
  it('writes the date day first with a short weekday', () => {
    expect(formatDayDate('2027-05-12', 'en-AU')).toBe('Wed 12 May')
    expect(formatDayDate('2027-05-12', 'es-MX')).toMatch(/^mié 12 (de )?may/)
  })

  it('can leave the weekday out', () => {
    expect(formatDayDate('2027-05-12', 'en-AU', false)).toBe('12 May')
  })

  it('adds the year on request, for dates that are not this trip (a passport stamp)', () => {
    expect(formatDayDate('2026-05-05', 'en-AU', false, true)).toBe('5 May 2026')
    expect(formatDayDate('2026-05-05', 'es-MX', false, true)).toMatch(
      /^5 (de )?may(o)?( de)? 2026$/
    )
  })

  it('rejects anything but YYYY-MM-DD', () => {
    expect(() => formatDayDate('12/05/2027', 'en-AU')).toThrow(/YYYY-MM-DD/)
  })
})
