import { InjectionToken } from '@angular/core'
import { Dexie, type DexieOptions, type Table } from 'dexie'
import type {
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
  TripRecord,
} from './records'

export const OFFLINE_DB_NAME = 'monki-trips'

/**
 * The device's copy of every trip it can open, plus the outbox and meta.
 * The UI reads trip data only from here; the API only refills it.
 *
 * Schema changes are additive: add a `this.version(n)` block below, never
 * edit version 1 once it has shipped.
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
  }
}

export const OFFLINE_DB = new InjectionToken<MonkiTripsDb>('OFFLINE_DB', {
  providedIn: 'root',
  factory: () => new MonkiTripsDb(),
})
