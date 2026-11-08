import type {
  BudgetCategory,
  EmergencyInfoContent,
  Expense,
  ExpenseShare,
  EventSegmentRow,
  PhraseCard,
  SegmentSeat,
  TaskOrigin,
  TaskPriority,
  TripDocumentRow,
  TripEventRow,
  TripMemberRole,
  TripStopRow,
} from '@monkitrips/shared'
import type { OutboxState } from '../../domain/outbox-transition'

/**
 * Row shapes of the offline database. Every synced row carries a UUIDv7
 * `id`, its `tripId` (except trips), an ISO `updatedAt` and `syncState:
 * 'pending'` while a local change waits in the outbox. Shapes stay minimal:
 * each feature package adds its own fields. `syncState: 'failed'` marks a
 * row whose last change the server refused (its outbox entry is failed).
 */
export type SyncState = 'pending' | 'failed'

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
  /** The signed-in person's role, when the list route told us; the members table is authoritative. */
  role?: TripMemberRole
}

/**
 * An itinerary event as the device keeps it: the API's `TripEventRow`
 * without the tombstone. Local times (`startsLocal`, `endsLocal`) sit next
 * to their IANA zones; `startsAt`, `startsOn` and `endsAt` are derived (by
 * the server, or on the device for an optimistic row).
 */
export type EventRecord = Omit<TripEventRow, 'deletedAt'> & SyncedRecord

/** A stop of the trip (a place you stay in): the API's `TripStopRow` without the tombstone. */
export type StopRecord = Omit<TripStopRow, 'deletedAt'> & SyncedRecord

/** One leg of a transport event: the API's `EventSegmentRow` without the tombstone. */
export type SegmentRecord = Omit<EventSegmentRow, 'deletedAt'> & SyncedRecord

/** A traveller's seat on one leg: the API's `SegmentSeat` without the tombstone. */
export type SeatRecord = Omit<SegmentSeat, 'deletedAt'> & SyncedRecord

export interface StayRecord extends TripScopedRecord {
  /** First night, YYYY-MM-DD. */
  night: string
  name: string
  /** Number of nights. */
  nights: number
}

/**
 * A document of the trip as the device keeps it: the API's
 * `TripDocumentRow` without the tombstone. A `file` carries the server's
 * `mime`, `sizeBytes` and `sha256` (the copy in `docBlobs` is verified
 * against it); a `link` carries its `url`.
 */
export type DocRecord = Omit<TripDocumentRow, 'deletedAt'> & SyncedRecord

/** A document saved for offline use: the bytes plus what verifies them. */
export interface DocBlobRecord {
  docId: string
  sha256: string
  size: number
  mime: string
  /**
   * The file's bytes. An ArrayBuffer, never a Blob: WebKit refuses Blobs
   * in IndexedDB in private sessions ("Error preparing Blob/File data to
   * be stored in object store"), and an ArrayBuffer stores everywhere.
   */
  bytes?: ArrayBuffer
  /** How copies saved before `bytes` kept their file; still read, never written. */
  blob?: Blob
  /** ISO timestamp. */
  savedAt: string
}

/**
 * A task as the device keeps it: the API's `TripTaskRow` without the
 * tombstone. `titleKey` names a translation for generated tasks (print,
 * template), rendered with `title` as the fallback and parameter;
 * `templateItemKey` ties a pre-trip checklist item to its template entry.
 */
export interface TaskRecord extends TripScopedRecord {
  eventId: string | null
  title: string
  titleKey: string | null
  notes: string | null
  /** YYYY-MM-DD, null for an undated task. */
  dueOn: string | null
  priority: TaskPriority
  /** ISO instant when it was ticked, null while open. */
  doneAt: string | null
  doneBy: string | null
  origin: TaskOrigin
  sourceDocumentId: string | null
  templateItemKey: string | null
}

/** Emergency information of a trip: one row per trip, `id` equals `tripId`. */
export interface EmergencyRecord extends TripScopedRecord {
  content: EmergencyInfoContent
  schemaVersion: number
}

/**
 * The phrase cards of one trip and language, as `POST /trips/:tripId/phrase-cards`
 * generated them. Read-only on the device: the pull (`phrase_card`) and the
 * generate call write it. A card that names a person keeps the `{name}`
 * placeholder; the device fills it only when it shows the card.
 */
export interface PhraseCardRecord extends TripScopedRecord {
  /** Canonical BCP 47 tag (`th`, `pt-BR`). */
  language: string
  cards: PhraseCard[]
}

export interface ChecklistRecord extends TripScopedRecord {
  label: string
  checked: boolean
}

/**
 * An expense as the device keeps it: the API's `Expense` without the
 * tombstone. `baseAmountMinor` and `fxRate` stay null while the rate is
 * missing (a quick capture made offline gets its rate when the server
 * applies it); `needsDetails` marks a capture with only amount and category.
 */
export type ExpenseRecord = Omit<Expense, 'deletedAt'> & SyncedRecord

/**
 * One traveller's part of an expense (split mode): the API's `ExpenseShare`
 * without the tombstone, in the expense's own currency. The live shares of
 * an expense add up to its amount; the device writes them as a whole
 * through the expense's `shares` field, never one by one.
 */
export type ExpenseShareRecord = Omit<ExpenseShare, 'deletedAt'> & SyncedRecord

/** A budget line of a trip: a default one (`key`) or a custom one (`name`), with an optional budget. */
export type BudgetCategoryRecord = Omit<BudgetCategory, 'deletedAt'> & SyncedRecord

export interface MemberRecord extends TripScopedRecord {
  userId: string
  role: TripMemberRole
  /** Display name of the account, absent on rows written before the sync client. */
  displayName?: string
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
  /** When the server created it (ties on `position` follow it); absent until it syncs. */
  createdAt?: string
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
  /** `<entity>.<op>` for a sync mutation (`task.upsert`); older free-form kinds are rejected on push. */
  kind: string
  /** An `OutboxMutation` (mutation.ts) for everything the sync client sends. */
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
  stops: StopRecord
  segments: SegmentRecord
  seats: SeatRecord
  stays: StayRecord
  docs: DocRecord
  tasks: TaskRecord
  checklist: ChecklistRecord
  expenses: ExpenseRecord
  expenseShares: ExpenseShareRecord
  budgetCategories: BudgetCategoryRecord
  members: MemberRecord
  travellers: TravellerRecord
  emergency: EmergencyRecord
  phraseCards: PhraseCardRecord
}

export type SyncTable = keyof SyncRowMap

export const SYNC_TABLES: readonly SyncTable[] = [
  'trips',
  'events',
  'stops',
  'segments',
  'seats',
  'stays',
  'docs',
  'tasks',
  'checklist',
  'expenses',
  'expenseShares',
  'budgetCategories',
  'members',
  'travellers',
  'emergency',
  'phraseCards',
]

/** One row the server changed: an upsert, or a delete (a tombstone needs only the id). */
export type SyncChange = {
  [K in SyncTable]:
    | { table: K; row: SyncRowMap[K]; deleted?: false }
    | { table: K; row: Pick<SyncRowMap[K], 'id'>; deleted: true }
}[SyncTable]
