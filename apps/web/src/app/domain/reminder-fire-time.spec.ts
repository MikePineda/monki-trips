import { reminderFireTime } from './reminder-fire-time'

const NOW = '2026-11-07T12:00:00.000Z'

function at(instant: string, locale = 'en-AU', timeZone = 'UTC') {
  return reminderFireTime({ instant, now: NOW, timeZone, locale })
}

describe('reminderFireTime', () => {
  it('a reminder later today reads as today and its local clock time', () => {
    expect(at('2026-11-07T18:05:00.000Z')).toBe('Today 18:05')
  })

  it('a reminder tomorrow reads as tomorrow', () => {
    expect(at('2026-11-08T08:00:00.000Z')).toBe('Tomorrow 08:00')
  })

  it('follows the language: Spanish words, the same 24 h clock', () => {
    expect(at('2026-11-08T08:00:00.000Z', 'es-ES')).toBe('Mañana 08:00')
    expect(at('2026-11-07T18:05:00.000Z', 'es-ES')).toBe('Hoy 18:05')
  })

  it('days and the clock follow the device zone, not UTC', () => {
    // 20:00 UTC on 7 Nov is 03:00 on 8 Nov in Bangkok (UTC+7): tomorrow there.
    expect(at('2026-11-07T20:00:00.000Z', 'en-AU', 'Asia/Bangkok')).toBe('Tomorrow 03:00')
  })

  it('two days out names the distance in days', () => {
    expect(at('2026-11-09T07:30:00.000Z')).toBe('In 2 days 07:30')
  })
})
