import { Dexie, type DexieOptions, type Table } from 'dexie'
import type {
  ActivityRecord,
  BudgetCategoryRecord,
  ChecklistRecord,
  DocBlobRecord,
  DocRecord,
  EmergencyRecord,
  EventRecord,
  ExpenseRecord,
  MemberRecord,
  MetaRecord,
  OutboxRecord,
  PhraseCardRecord,
  SeatRecord,
  SegmentRecord,
  StayRecord,
  StopRecord,
  TaskRecord,
  TravellerRecord,
  TripRecord,
} from './records'

export const OFFLINE_DB_NAME = 'monki-trips'

/**
 * The device's copy of every trip it can open, plus the outbox and meta.
 * The UI reads trip data only from here; the API only refills it.
 *
 * Schema changes are additive: add a `this.version(n)` block below, never
 * edit version 1 once it has shipped.
 *
 * Only `offline-db.ts` loads this file, with a dynamic import: Dexie stays
 * out of the initial bundle. Everything else imports its types only and
 * reaches the instance through `OFFLINE_DB`.
 */
export class MonkiTripsDb extends Dexie {
  declare trips: Table<TripRecord, string>
  declare events: Table<EventRecord, string>
  declare stops: Table<StopRecord, string>
  declare segments: Table<SegmentRecord, string>
  declare seats: Table<SeatRecord, string>
  declare stays: Table<StayRecord, string>
  declare docs: Table<DocRecord, string>
  declare docBlobs: Table<DocBlobRecord, string>
  declare tasks: Table<TaskRecord, string>
  declare checklist: Table<ChecklistRecord, string>
  declare expenses: Table<ExpenseRecord, string>
  declare budgetCategories: Table<BudgetCategoryRecord, string>
  declare members: Table<MemberRecord, string>
  declare travellers: Table<TravellerRecord, string>
  declare activity: Table<ActivityRecord, string>
  declare emergency: Table<EmergencyRecord, string>
  declare phraseCards: Table<PhraseCardRecord, string>
  declare meta: Table<MetaRecord, string>
  declare outbox: Table<OutboxRecord, string>

  /** `options` lets specs pass a fresh fake IndexedDB per test. */
  constructor(options?: DexieOptions) {
    super(OFFLINE_DB_NAME, options)
    this.version(1).stores({
      trips: 'id, updatedAt',
      events: 'id, tripId, [tripId+day], updatedAt',
      stays: 'id, tripId, [tripId+night], updatedAt',
      docs: 'id, tripId, updatedAt',
      docBlobs: 'docId',
      tasks: 'id, tripId, updatedAt',
      checklist: 'id, tripId, updatedAt',
      expenses: 'id, tripId, [tripId+date], updatedAt',
      members: 'id, tripId, userId, [tripId+userId]',
      meta: 'key',
      outbox: 'id, state, createdAt',
    })
    // WP 1.7: travellers (written through the outbox) and the cached activity feed.
    this.version(2).stores({
      travellers: 'id, tripId, updatedAt',
      activity: 'id, tripId, [tripId+createdAt]',
    })
    // WP 1.6: emergency information, one row per trip (`id` = `tripId`).
    this.version(3).stores({
      emergency: 'id, tripId, updatedAt',
    })
    // WP 1.3: the itinerary. Events take the wire row (indexed by their local
    // start date), with the stops, the legs of a transport and the seats.
    this.version(4).stores({
      events: 'id, tripId, [tripId+startsOn], updatedAt',
      stops: 'id, tripId, updatedAt',
      segments: 'id, tripId, eventId, updatedAt',
      seats: 'id, tripId, segmentId, updatedAt',
    })
    // WP 2.2: money. Expenses take the wire row (indexed by the day they were
    // spent) next to the trip's budget categories. The pull skipped both
    // until now; the sync service sees the new entity mapping
    // (`syncedEntitiesKey`) and pulls from scratch once, so no upgrade here.
    this.version(5).stores({
      expenses: 'id, tripId, [tripId+spentOn], updatedAt',
      budgetCategories: 'id, tripId, updatedAt',
    })
    // WP 3.0b: phrase cards, one row per trip and language (read-only on the
    // device). Like money, the new entity mapping makes the sync service pull
    // from scratch once, so no upgrade function here.
    this.version(6).stores({
      phraseCards: 'id, tripId, [tripId+language], updatedAt',
    })
  }
}
