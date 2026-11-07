import type { OutboxState } from '../../domain/outbox-transition'

/**
 * Row shapes of the offline database. Every synced row carries a UUIDv7
 * `id`, its `tripId` (except trips), an ISO `updatedAt` and `syncState:
 * 'pending'` while a local change waits in the outbox. Shapes stay minimal:
 * each feature package adds its own fields.
 */
export type SyncState = 'pending'

interface SyncedRecord {
  id: string
  /** ISO timestamp of the last change the server (or this device) made. */
  updatedAt: string
  syncState?: SyncState
}

interface TripScopedRecord extends SyncedRecord {
  tripId: string
}

export interface TripRecord extends SyncedRecord {
  name: string
  /** YYYY-MM-DD */
  startDate: string
  /** YYYY-MM-DD */
  endDate: string
  /** ISO 4217 code. */
  baseCurrency: string
  /** `shared` pot or `split` between travellers; absent on rows written before WP 0.6b. */
  budgetMode?: string
  /** Integer minor units of `baseCurrency`, null for no budget. */
  budgetTotalMinor?: number | null
  /** IANA zone the trip's clocks follow; absent on rows written before WP 1.7. */
  homeTz?: string
}

export interface EventRecord extends TripScopedRecord {
  /** YYYY-MM-DD */
  day: string
  title: string
  /** ISO timestamp, absent for an all-day item. */
  startsAt?: string
}

export interface StayRecord extends TripScopedRecord {
  /** First night, YYYY-MM-DD. */
  night: string
  name: string
  /** Number of nights. */
  nights: number
}

export interface DocRecord extends TripScopedRecord {
  title: string
  mime: string
  size: number
  sha256: string
}

/** A document saved for offline use: the bytes plus what verifies them. */
export interface DocBlobRecord {
  docId: string
  sha256: string
  size: number
  mime: string
  blob: Blob
  /** ISO timestamp. */
  savedAt: string
}

export interface TaskRecord extends TripScopedRecord {
  title: string
  done: boolean
}

export interface ChecklistRecord extends TripScopedRecord {
  label: string
  checked: boolean
}

export interface ExpenseRecord extends TripScopedRecord {
  /** YYYY-MM-DD the money was spent. */
  date: string
  description: string
  /** Integer minor units of `currency`. */
  amountMinor: number
  /** ISO 4217 code. */
  currency: string
}

export interface MemberRecord extends TripScopedRecord {
  userId: string
  role: string
}

/**
 * Someone who travels: every member gets one, and a trip can hold people
 * without an account (`userId` null) for seats and expense shares. Written
 * through the outbox (`traveller.upsert` / `traveller.delete`).
 */
export interface TravellerRecord extends TripScopedRecord {
  displayName: string
  userId: string | null
  position: number
}

/**
 * One line of the trip's activity feed, as `GET /trips/:tripId/activity`
 * returns it: who (actor), what (entity and row), the action and the names
 * of the fields that changed. Field names only, never values. Cached so the
 * feed reads offline; `id` is the server's, the feed orders by `createdAt`.
 */
export interface ActivityRecord {
  id: string
  tripId: string
  actorUserId: string | null
  actorName: string | null
  entity: string
  entityId: string
  action: string
  fields: string[]
  /** ISO instant. */
  createdAt: string
}

export interface MetaRecord {
  key: string
  value: unknown
}

/** A local mutation waiting for the server. */
export interface OutboxRecord {
  /** UUIDv7 = mutationId, the idempotency key on the server. */
  id: string
  tripId: string
  /** e.g. 'expense.create' (free string now; typed union later). */
  kind: string
  payload: unknown
  state: OutboxState
  attempts: number
  /** ISO timestamp. */
  createdAt: string
  /** ISO timestamp before which the entry is not resent; null = now. */
  nextAttemptAt: string | null
  /** The server's message when failed. */
  error: string | null
}

/** The tables the server fills through `/sync/pull`, with their row type. */
export interface SyncRowMap {
  trips: TripRecord
  events: EventRecord
  stays: StayRecord
  docs: DocRecord
  tasks: TaskRecord
  checklist: ChecklistRecord
  expenses: ExpenseRecord
  members: MemberRecord
  travellers: TravellerRecord
}

export type SyncTable = keyof SyncRowMap

export const SYNC_TABLES: readonly SyncTable[] = [
  'trips',
  'events',
  'stays',
  'docs',
  'tasks',
  'checklist',
  'expenses',
  'members',
  'travellers',
]

/** One row the server changed: an upsert, or a delete when `deleted`. */
export type SyncChange = {
  [K in SyncTable]: { table: K; row: SyncRowMap[K]; deleted?: boolean }
}[SyncTable]
