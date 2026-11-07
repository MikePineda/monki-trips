import { localToday } from './local-today'

describe('localToday', () => {
  it('follows the zone, not UTC: late evening in the Americas is still the same day', () => {
    expect(localToday('2026-11-08T03:30:00.000Z', 'America/Mexico_City')).toBe('2026-11-07')
    expect(localToday('2026-11-08T03:30:00.000Z', 'UTC')).toBe('2026-11-08')
  })

  it('an early morning in the east is already tomorrow', () => {
    expect(localToday('2026-11-07T15:30:00.000Z', 'Australia/Sydney')).toBe('2026-11-08')
  })

  it('refuses a value that is not an instant', () => {
    expect(() => localToday('yesterday', 'UTC')).toThrow(TypeError)
  })
})
