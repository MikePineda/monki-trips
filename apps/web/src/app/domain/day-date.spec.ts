import { formatDayDate } from './day-date'

describe('formatDayDate', () => {
  it('writes the date day first with a short weekday', () => {
    expect(formatDayDate('2027-05-12', 'en-AU')).toBe('Wed 12 May')
    expect(formatDayDate('2027-05-12', 'es-MX')).toMatch(/^mié 12 (de )?may/)
  })

  it('can leave the weekday out', () => {
    expect(formatDayDate('2027-05-12', 'en-AU', false)).toBe('12 May')
  })

  it('rejects anything but YYYY-MM-DD', () => {
    expect(() => formatDayDate('12/05/2027', 'en-AU')).toThrow(/YYYY-MM-DD/)
  })
})
