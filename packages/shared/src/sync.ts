import type { BudgetCategory, Expense, ExpenseShare } from './expense.ts'
import type { TripDocument } from './document.ts'
import type { EmergencyInfo, PhraseCards } from './emergency_info.ts'
import type { EventSegment, SegmentSeat, TripEvent } from './event.ts'
import type { Stop } from './stop.ts'
import type { Task } from './task.ts'
import type { Traveller } from './traveller.ts'
import type { Trip } from './trip.ts'
import type { TripMember } from './trip_member.ts'

/**
 * Entities a client may write through `POST /sync/push`. Members are read
 * only (they change through the members routes); `document` carries the
 * metadata only, the bytes go through the documents routes.
 */
export const SYNC_PUSH_ENTITIES = [
  'trip',
  'traveller',
  'stop',
  'event',
  'segment',
  'seat',
  'document',
  'task',
  'budget_category',
  'expense',
  'expense_share',
  'emergency',
] as const

export type SyncPushEntity = (typeof SYNC_PUSH_ENTITIES)[number]

/** Everything `GET /sync/pull` can return: the push entities plus the read-only ones. */
export const SYNC_ENTITIES = [...SYNC_PUSH_ENTITIES, 'member', 'phrase_card'] as const

export type SyncEntity = (typeof SYNC_ENTITIES)[number]

export const SYNC_OPS = ['upsert', 'delete'] as const

export type SyncOp = (typeof SYNC_OPS)[number]

/** Outcome of one mutation (also the CHECK on `sync_mutations.status`). */
export const SYNC_RESULT_STATUSES = ['applied', 'partial', 'duplicate', 'rejected'] as const

export type SyncResultStatus = (typeof SYNC_RESULT_STATUSES)[number]

/** How far back a client clock may claim a change happened (skewed devices). */
export const SYNC_CHANGED_AT_WINDOW_DAYS = 45

/** Tombstones older than this are purged; a pull cursor older than this answers 410. */
export const SYNC_PURGE_HORIZON_DAYS = 90

/** Mutations per push request. */
export const SYNC_PUSH_MAX_MUTATIONS = 100

/** Rows per pull page. */
export const SYNC_PULL_MAX_LIMIT = 500

/** The row of each entity on the wire. */
export interface SyncRowByEntity {
  trip: Trip
  member: TripMember
  traveller: Traveller
  stop: Stop
  event: TripEvent
  segment: EventSegment
  seat: SegmentSeat
  document: TripDocument
  task: Task
  budget_category: BudgetCategory
  expense: Expense
  expense_share: ExpenseShare
  emergency: EmergencyInfo
  phrase_card: PhraseCards
}

export type SyncChange = {
  [E in SyncEntity]: { entity: E; row: SyncRowByEntity[E] }
}[SyncEntity]

/**
 * One change a client made, possibly offline. `id` is the client-generated
 * UUID of the row (for `emergency` it equals `tripId`); `changes` holds only
 * the fields that changed, in the entity's wire shape; `changedAt` is when
 * the person made the change on the device (ISO instant), clamped on the
 * server to the last `SYNC_CHANGED_AT_WINDOW_DAYS` days.
 */
export interface SyncMutation {
  mutationId: string
  tripId: string
  entity: SyncPushEntity
  op: SyncOp
  id: string
  changes: Record<string, unknown>
  changedAt: string
}

export interface SyncPushInput {
  mutations: SyncMutation[]
}

/** Why a mutation was rejected, in the request's locale. `errors` lists validation failures. */
export interface SyncMutationError {
  code: string
  message: string
  errors?: { field: string; rule: string; message: string }[]
}

/**
 * The outcome of one mutation. `partial` means at least one field lost the
 * last-write-wins comparison (`rejectedFields`); `duplicate` is a replayed
 * `mutationId` answered from the stored result; `row` is the server's row
 * after the mutation whenever the row exists.
 */
export interface SyncMutationResult {
  mutationId: string
  status: SyncResultStatus
  rejectedFields?: string[]
  error?: SyncMutationError
  row?: SyncRowByEntity[SyncPushEntity] | null
}

export interface SyncPushOutput {
  results: SyncMutationResult[]
}

/**
 * A page of `GET /sync/pull`. Without a cursor it is a snapshot of every
 * live row of every trip the person belongs to; with one, every row
 * (tombstones included) changed after it. `tripIds` is authoritative: the
 * client drops any trip it holds that is not listed. `cursor` is opaque.
 */
export interface SyncPullOutput {
  changes: SyncChange[]
  tripIds: string[]
  cursor: string
  hasMore: boolean
}
