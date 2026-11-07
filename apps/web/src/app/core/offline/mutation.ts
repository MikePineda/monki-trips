import { SYNC_OPS, SYNC_PUSH_ENTITIES, type SyncOp, type SyncPushEntity } from '@monkitrips/shared'
import type { OutboxRecord } from './records'

/**
 * What an outbox entry carries for `POST /sync/push`: one change to one
 * row, in the entity's wire shape. The entry's own `id` is the
 * `mutationId` and its `tripId` the trip; `changedAt` is when the person
 * made the change on the device.
 */
export interface OutboxMutation {
  entity: SyncPushEntity
  op: SyncOp
  /** The row's client UUID (for `emergency`, the trip id). */
  id: string
  /** Only the fields that changed. Empty for a delete. */
  changes: Record<string, unknown>
  /** ISO instant. */
  changedAt: string
}

/** The outbox `kind` of a mutation, for the "Pending" sheet and specs: `task.upsert`. */
export function mutationKind(mutation: Pick<OutboxMutation, 'entity' | 'op'>): string {
  return `${mutation.entity}.${mutation.op}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** True for a payload the sync client can send; older free-form entries fail this. */
export function isOutboxMutation(payload: unknown): payload is OutboxMutation {
  return (
    isRecord(payload) &&
    (SYNC_PUSH_ENTITIES as readonly unknown[]).includes(payload['entity']) &&
    (SYNC_OPS as readonly unknown[]).includes(payload['op']) &&
    typeof payload['id'] === 'string' &&
    isRecord(payload['changes']) &&
    typeof payload['changedAt'] === 'string'
  )
}

/** The mutation of an outbox entry, or null when the entry carries something else. */
export function outboxMutation(entry: Pick<OutboxRecord, 'payload'>): OutboxMutation | null {
  return isOutboxMutation(entry.payload) ? entry.payload : null
}
