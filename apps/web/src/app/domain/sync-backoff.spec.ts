import { MAX_BACKOFF_MS, backoffMs } from './sync-backoff'

describe('backoffMs', () => {
  it('waits one second before the first retry', () => {
    expect(backoffMs(0)).toBe(1000)
  })

  it('doubles the wait on every further attempt', () => {
    expect([1, 2, 3, 4, 5].map(backoffMs)).toEqual([2000, 4000, 8000, 16_000, 32_000])
  })

  it('never waits longer than a minute', () => {
    expect(backoffMs(6)).toBe(MAX_BACKOFF_MS)
    expect(backoffMs(50)).toBe(60_000)
    expect(backoffMs(5000)).toBe(60_000)
  })

  it('treats a negative or fractional attempt as the nearest valid one', () => {
    expect(backoffMs(-3)).toBe(1000)
    expect(backoffMs(1.7)).toBe(2000)
  })
})
