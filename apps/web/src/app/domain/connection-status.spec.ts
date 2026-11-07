import { STALE_AFTER_MS, deriveConnectionStatus, type ConnectionInputs } from './connection-status'

const NOW = new Date('2026-11-07T12:00:00Z')

function inputs(overrides: Partial<ConnectionInputs> = {}): ConnectionInputs {
  return {
    online: true,
    syncing: false,
    pendingCount: 0,
    failedCount: 0,
    lastPullAt: '2026-11-07T11:00:00Z',
    now: NOW,
    ...overrides,
  }
}

describe('deriveConnectionStatus', () => {
  it('is synced (hidden) when online, idle, nothing queued and the data is fresh', () => {
    expect(deriveConnectionStatus(inputs())).toEqual({ state: 'synced', count: 0 })
  })

  it('a failed mutation wins over everything else and carries its count', () => {
    const status = deriveConnectionStatus(
      inputs({ online: false, syncing: true, pendingCount: 3, failedCount: 1 })
    )

    expect(status).toEqual({ state: 'failed', count: 1 })
  })

  it('offline wins over syncing and pending', () => {
    const status = deriveConnectionStatus(inputs({ online: false, syncing: true, pendingCount: 2 }))

    expect(status).toEqual({ state: 'offline', count: 2 })
  })

  it('syncing shows how many mutations are being sent', () => {
    const status = deriveConnectionStatus(inputs({ syncing: true, pendingCount: 3 }))

    expect(status).toEqual({ state: 'syncing', count: 3 })
  })

  it('pending mutations show their count while online and not syncing', () => {
    expect(deriveConnectionStatus(inputs({ pendingCount: 3 }))).toEqual({
      state: 'pending',
      count: 3,
    })
  })

  it('data older than 24 hours is stale and tells its age in whole days', () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * STALE_AFTER_MS - 60_000).toISOString()

    expect(deriveConnectionStatus(inputs({ lastPullAt: twoDaysAgo }))).toEqual({
      state: 'stale',
      count: 2,
    })
  })

  it('data exactly one day old is not stale yet', () => {
    const oneDayAgo = new Date(NOW.getTime() - STALE_AFTER_MS).toISOString()

    expect(deriveConnectionStatus(inputs({ lastPullAt: oneDayAgo })).state).toBe('synced')
  })

  it('never pulled means nothing to be stale about', () => {
    expect(deriveConnectionStatus(inputs({ lastPullAt: null })).state).toBe('synced')
  })

  it('pending beats stale', () => {
    const old = new Date(NOW.getTime() - 3 * STALE_AFTER_MS).toISOString()

    expect(deriveConnectionStatus(inputs({ pendingCount: 1, lastPullAt: old })).state).toBe(
      'pending'
    )
  })
})
