import { Dexie, type DexieOptions, type Table } from 'dexie'
import type {
  ActivityRecord,
  ChecklistRecord,
  DocBlobRecord,
  DocRecord,
  EventRecord,
  ExpenseRecord,
  MemberRecord,
  MetaRecord,
  OutboxRecord,
  StayRecord,
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
  declare stays: Table<StayRecord, string>
  declare docs: Table<DocRecord, string>
  declare docBlobs: Table<DocBlobRecord, string>
  declare tasks: Table<TaskRecord, string>
  declare checklist: Table<ChecklistRecord, string>
  declare expenses: Table<ExpenseRecord, string>
  declare members: Table<MemberRecord, string>
  declare travellers: Table<TravellerRecord, string>
  declare activity: Table<ActivityRecord, string>
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
  }
}
