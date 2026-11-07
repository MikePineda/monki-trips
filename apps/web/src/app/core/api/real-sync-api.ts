import type { SyncChange as WireChange, SyncMutation, SyncMutationResult } from '@monkitrips/shared'
import { toEmergencyRecord } from '../offline/emergency-record'
import { ENTITY_TABLES } from '../offline/entity-tables'
import { toEventRecord } from '../offline/event-record'
import { toMemberRecord } from '../offline/member-record'
import { toSeatRecord } from '../offline/seat-record'
import { toSegmentRecord } from '../offline/segment-record'
import { toStopRecord } from '../offline/stop-record'
import { outboxMutation } from '../offline/mutation'
import type { OutboxRecord, SyncChange } from '../offline/records'
import {
  SyncCursorExpired,
  type SyncApi,
  type SyncPullResult,
  type SyncPushResult,
} from '../offline/sync-api'
import { toTaskRecord } from '../offline/task-record'
import { toTravellerRecord } from '../offline/traveller-record'
import { toTripRecord } from '../offline/trip-record'
import type { ApiClientLoader } from './api'
import { ApiFailure, apiCall } from './api-failure'

/** The device drops its local row: the server's tombstone, or the unique row that already exists there, wins. */
const ROW_LOST_CODES = new Set(['E_ROW_DELETED', 'E_CONFLICT'])

/**
 * `SyncApi` over the typed client: `GET /sync/pull` pages become device
 * rows (entities without a device table yet are skipped), outbox entries
 * become `POST /sync/push` mutations and each result maps onto the outbox
 * state machine: applied and duplicate are accepted; partial means the
 * server kept newer fields (its row wins); a tombstone or a unique-row
 * conflict drops the device's row; any other rejection is kept for the
 * person to decide.
 */
export class RealSyncApi implements SyncApi {
  constructor(private readonly client: ApiClientLoader) {}

  async pull(cursor: string | null): Promise<SyncPullResult> {
    const api = await this.client()
    try {
      const { data } = await apiCall(() =>
        api.request('sync.pull', { query: cursor ? { cursor } : {} })
      )
      return {
        cursor: data.cursor,
        tripIds: data.tripIds,
        hasMore: data.hasMore,
        changes: data.changes.flatMap(toDeviceChange),
      }
    } catch (error) {
      if (error instanceof ApiFailure && error.is('E_SYNC_CURSOR_EXPIRED')) {
        throw new SyncCursorExpired()
      }
      throw error
    }
  }

  async push(entries: OutboxRecord[]): Promise<SyncPushResult> {
    const result: SyncPushResult = { accepted: [], rejected: [], conflicts: [] }
    const mutations: SyncMutation[] = []
    for (const entry of entries) {
      const mutation = outboxMutation(entry)
      if (mutation) {
        mutations.push({ mutationId: entry.id, tripId: entry.tripId, ...mutation })
      } else {
        result.rejected.push({ id: entry.id, message: `Unsupported outbox entry: ${entry.kind}` })
      }
    }
    if (mutations.length === 0) {
      return result
    }
    const api = await this.client()
    const { data } = await apiCall(() => api.request('sync.push', { body: { mutations } }))
    for (const outcome of data.results) {
      const mutation = mutations.find((candidate) => candidate.mutationId === outcome.mutationId)
      if (mutation) {
        collect(result, mutation, outcome)
      }
    }
    return result
  }
}

function collect(result: SyncPushResult, mutation: SyncMutation, outcome: SyncMutationResult) {
  const table = ENTITY_TABLES[mutation.entity]
  switch (outcome.status) {
    case 'applied':
    case 'duplicate':
      result.accepted.push(mutation.mutationId)
      return
    case 'partial': {
      const serverRow = outcome.row
        ? toDeviceChange({ entity: mutation.entity, row: outcome.row } as WireChange)[0]
        : undefined
      if (serverRow) {
        result.conflicts.push({ id: mutation.mutationId, serverRow })
      } else {
        result.accepted.push(mutation.mutationId)
      }
      return
    }
    case 'rejected': {
      const code = outcome.error?.code ?? ''
      if (ROW_LOST_CODES.has(code) && table) {
        result.conflicts.push({
          id: mutation.mutationId,
          serverRow: { table, row: { id: mutation.id }, deleted: true } as SyncChange,
        })
      } else {
        result.rejected.push({
          id: mutation.mutationId,
          message: outcome.error?.message ?? code ?? 'Rejected by the server',
        })
      }
      return
    }
  }
}

/** A server change as the device stores it: none for entities without a device table yet. */
export function toDeviceChange(change: WireChange): SyncChange[] {
  switch (change.entity) {
    case 'trip':
      return change.row.deletedAt
        ? [{ table: 'trips', row: { id: change.row.id }, deleted: true }]
        : [{ table: 'trips', row: toTripRecord(change.row) }]
    case 'member':
      return change.row.deletedAt
        ? [{ table: 'members', row: { id: change.row.id }, deleted: true }]
        : [{ table: 'members', row: toMemberRecord(change.row) }]
    case 'traveller':
      return change.row.deletedAt
        ? [{ table: 'travellers', row: { id: change.row.id }, deleted: true }]
        : [{ table: 'travellers', row: toTravellerRecord(change.row) }]
    case 'stop':
      return change.row.deletedAt
        ? [{ table: 'stops', row: { id: change.row.id }, deleted: true }]
        : [{ table: 'stops', row: toStopRecord(change.row) }]
    case 'event':
      return change.row.deletedAt
        ? [{ table: 'events', row: { id: change.row.id }, deleted: true }]
        : [{ table: 'events', row: toEventRecord(change.row) }]
    case 'segment':
      return change.row.deletedAt
        ? [{ table: 'segments', row: { id: change.row.id }, deleted: true }]
        : [{ table: 'segments', row: toSegmentRecord(change.row) }]
    case 'seat':
      return change.row.deletedAt
        ? [{ table: 'seats', row: { id: change.row.id }, deleted: true }]
        : [{ table: 'seats', row: toSeatRecord(change.row) }]
    case 'task':
      return change.row.deletedAt
        ? [{ table: 'tasks', row: { id: change.row.id }, deleted: true }]
        : [{ table: 'tasks', row: toTaskRecord(change.row) }]
    case 'emergency':
      return change.row.deletedAt
        ? [{ table: 'emergency', row: { id: change.row.tripId }, deleted: true }]
        : [{ table: 'emergency', row: toEmergencyRecord(change.row) }]
    default:
      return []
  }
}
