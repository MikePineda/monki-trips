import type { SyncEntity } from '@monkitrips/shared'
import type { SyncTable } from './records'

/**
 * Which device table holds each sync entity. Entities missing here
 * (expense shares, phrase cards...) are ignored by the sync client until
 * their work package defines the device's row shape. When this set changes
 * the sync service pulls from scratch once (`syncedEntitiesKey`), so rows of
 * a newly mapped entity that the old cursor had already skipped arrive too.
 * This is the one way a mapping change forces a full pull: a Dexie upgrade
 * never drops the cursor for it.
 */
export const ENTITY_TABLES: Partial<Record<SyncEntity, SyncTable>> = {
  trip: 'trips',
  member: 'members',
  traveller: 'travellers',
  stop: 'stops',
  event: 'events',
  segment: 'segments',
  seat: 'seats',
  document: 'docs',
  task: 'tasks',
  emergency: 'emergency',
  expense: 'expenses',
  budget_category: 'budgetCategories',
}

/** The sync entity a device table holds, for mutations. */
export const TABLE_ENTITIES: Partial<Record<SyncTable, SyncEntity>> = {
  trips: 'trip',
  members: 'member',
  travellers: 'traveller',
  stops: 'stop',
  events: 'event',
  segments: 'segment',
  seats: 'seat',
  docs: 'document',
  tasks: 'task',
  emergency: 'emergency',
  expenses: 'expense',
  budgetCategories: 'budget_category',
}

/** The mapped entities as one stable string, stored in meta to detect a new mapping. */
export function syncedEntitiesKey(): string {
  return Object.keys(ENTITY_TABLES).sort().join(',')
}
