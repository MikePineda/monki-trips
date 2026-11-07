/**
 * The outbox state machine: `pending → syncing → (removed | failed)`, a
 * failed entry goes back to `pending` on retry or is removed on discard,
 * and `reset` returns a `syncing` entry to `pending` (boot after a crash
 * mid-sync, or a network error before the server answered). Anything else
 * is a bug and throws.
 */
export type OutboxState = 'pending' | 'syncing' | 'failed'

export type OutboxEvent = 'send' | 'acknowledged' | 'rejected' | 'retry' | 'discard' | 'reset'

export type OutboxTransition = { state: OutboxState } | { removed: true }

export class IllegalOutboxTransition extends Error {
  constructor(
    readonly from: OutboxState,
    readonly event: OutboxEvent
  ) {
    super(`Illegal outbox transition: ${from} --${event}-->`)
    this.name = 'IllegalOutboxTransition'
  }
}

const MOVES: Record<OutboxState, Partial<Record<OutboxEvent, OutboxTransition>>> = {
  pending: { send: { state: 'syncing' } },
  syncing: {
    acknowledged: { removed: true },
    rejected: { state: 'failed' },
    reset: { state: 'pending' },
  },
  failed: { retry: { state: 'pending' }, discard: { removed: true } },
}

export function transition(state: OutboxState, event: OutboxEvent): OutboxTransition {
  const next = MOVES[state][event]
  if (!next) {
    throw new IllegalOutboxTransition(state, event)
  }
  return next
}
