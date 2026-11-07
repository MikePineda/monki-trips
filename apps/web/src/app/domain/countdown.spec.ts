import { countdownKey, countdownParts } from './countdown'

describe('countdown', () => {
  it('splits what is left into days, hours and minutes, rounded down', () => {
    const parts = countdownParts(((26 * 60 + 32) * 60 + 59) * 1000)

    expect(parts).toEqual({ days: 1, hours: 2, minutes: 32, soon: false })
    expect(countdownKey(parts)).toBe('days')
  })

  it('reads hours, then minutes, then soon', () => {
    expect(countdownKey(countdownParts(92 * 60_000))).toBe('hours')
    expect(countdownKey(countdownParts(5 * 60_000))).toBe('minutes')
    expect(countdownKey(countdownParts(30_000))).toBe('soon')
    expect(countdownKey(countdownParts(-1))).toBe('soon')
  })
})
