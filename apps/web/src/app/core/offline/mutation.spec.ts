import { isOutboxMutation, mutationKind } from './mutation'

describe('outbox mutations', () => {
  const mutation = {
    entity: 'task',
    op: 'upsert',
    id: 'k1',
    changes: { title: 'Buy an adapter' },
    changedAt: '2026-11-07T12:00:00.000Z',
  }

  it('names the kind after the entity and the operation', () => {
    expect(mutationKind({ entity: 'emergency', op: 'upsert' })).toBe('emergency.upsert')
  })

  it('recognises a well-formed mutation', () => {
    expect(isOutboxMutation(mutation)).toBe(true)
  })

  it('refuses an unknown entity, a free-form payload and a missing instant', () => {
    expect(isOutboxMutation({ ...mutation, entity: 'checklist' })).toBe(false)
    expect(isOutboxMutation({ amountMinor: 1250 })).toBe(false)
    expect(isOutboxMutation({ ...mutation, changedAt: undefined })).toBe(false)
  })
})
