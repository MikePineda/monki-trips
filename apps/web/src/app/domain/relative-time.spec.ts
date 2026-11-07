import { calendarDateIn, clockTimeIn, relativeTime } from './relative-time'

const NOW = '2026-11-07T12:00:00.000Z'

function at(instant: string, timeZone = 'UTC', locale = 'en-AU') {
  return relativeTime({ instant, now: NOW, timeZone, locale })
}

describe('relativeTime', () => {
  it('a change under a minute ago reads as now', () => {
    expect(at('2026-11-07T11:59:30.000Z')).toBe('now')
  })

  it('minutes and hours of the same day count from now', () => {
    expect(at('2026-11-07T11:40:00.000Z')).toBe('20 mins ago')
    expect(at('2026-11-07T09:10:00.000Z')).toBe('2 hrs ago')
  })

  it('yesterday follows the calendar of the trip zone, not the elapsed hours', () => {
    // 01:00 in Bangkok (UTC+7) on 7 Nov is still "today" there; 23:30 on 6 Nov is yesterday.
    expect(at('2026-11-06T18:00:00.000Z', 'Asia/Bangkok')).toBe('18 hrs ago')
    expect(at('2026-11-06T16:30:00.000Z', 'Asia/Bangkok')).toBe('yesterday')
    // The same instants seen from UTC: 18:00 is yesterday, 16:30 too.
    expect(at('2026-11-06T18:00:00.000Z', 'UTC')).toBe('yesterday')
  })

  it('a week or more ago shows the date in the trip zone', () => {
    expect(at('2026-10-28T23:30:00.000Z', 'Asia/Bangkok')).toBe('Thu 29 Oct')
  })

  it('speaks the given locale', () => {
    expect(at('2026-11-07T11:40:00.000Z', 'UTC', 'es-MX')).toBe('hace 20 min')
    expect(at('2026-11-06T10:00:00.000Z', 'UTC', 'es-MX')).toBe('ayer')
  })

  it('a change in the future never reads as negative', () => {
    expect(at('2026-11-07T12:00:30.000Z')).toBe('now')
  })

  it('refuses anything that is not an instant', () => {
    expect(() => at('2026-W45-6')).toThrow(TypeError)
  })
})

describe('calendarDateIn and clockTimeIn', () => {
  it('cut the day and read the clock in the zone', () => {
    expect(calendarDateIn('2026-11-06T18:00:00.000Z', 'Asia/Bangkok')).toBe('2026-11-07')
    expect(calendarDateIn('2026-11-06T18:00:00.000Z', 'UTC')).toBe('2026-11-06')
    expect(clockTimeIn('2026-11-06T18:05:00.000Z', 'Asia/Bangkok', 'en')).toBe('01:05')
  })
})
