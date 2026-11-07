import {
  IllegalOutboxTransition,
  transition,
  type OutboxEvent,
  type OutboxState,
} from './outbox-transition'

describe('outbox transition', () => {
  it('a pending mutation becomes syncing when it is sent', () => {
    expect(transition('pending', 'send')).toEqual({ state: 'syncing' })
  })

  it('an acknowledged mutation leaves the outbox', () => {
    expect(transition('syncing', 'acknowledged')).toEqual({ removed: true })
  })

  it('a rejected mutation is kept as failed', () => {
    expect(transition('syncing', 'rejected')).toEqual({ state: 'failed' })
  })

  it('a mutation caught mid-sync goes back to pending on reset', () => {
    expect(transition('syncing', 'reset')).toEqual({ state: 'pending' })
  })

  it('the user can retry a failed mutation', () => {
    expect(transition('failed', 'retry')).toEqual({ state: 'pending' })
  })

  it('the user can discard a failed mutation', () => {
    expect(transition('failed', 'discard')).toEqual({ removed: true })
  })

  it('a pending mutation cannot fail without being sent first', () => {
    expect(() => transition('pending', 'rejected')).toThrow(IllegalOutboxTransition)
  })

  it('a pending mutation cannot be removed', () => {
    expect(() => transition('pending', 'acknowledged')).toThrow(IllegalOutboxTransition)
    expect(() => transition('pending', 'discard')).toThrow(IllegalOutboxTransition)
  })

  it('every move outside the state machine throws and names it', () => {
    const legal = new Set([
      'pending:send',
      'syncing:acknowledged',
      'syncing:rejected',
      'syncing:reset',
      'failed:retry',
      'failed:discard',
    ])
    const states: OutboxState[] = ['pending', 'syncing', 'failed']
    const events: OutboxEvent[] = ['send', 'acknowledged', 'rejected', 'retry', 'discard', 'reset']

    for (const state of states) {
      for (const event of events) {
        if (legal.has(`${state}:${event}`)) {
          expect(() => transition(state, event)).not.toThrow()
        } else {
          expect(() => transition(state, event)).toThrow(`${state} --${event}-->`)
        }
      }
    }
  })
})
