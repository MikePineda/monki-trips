import type { SyncEntity } from '@monkitrips/shared'
import type { SyncTable } from './records'

/**
 * Which device table holds each sync entity. Entities missing here (events,
 * stops, documents, expenses...) are ignored by the sync client until their
 * work package defines the device's row shape; the pull delivers them
 * again from the cursor each package starts with (a cursor reset).
 */
export const ENTITY_TABLES: Partial<Record<SyncEntity, SyncTable>> = {
  trip: 'trips',
  member: 'members',
  task: 'tasks',
  emergency: 'emergency',
}

/** The sync entity a device table holds, for mutations. */
export const TABLE_ENTITIES: Partial<Record<SyncTable, SyncEntity>> = {
  trips: 'trip',
  members: 'member',
  tasks: 'task',
  emergency: 'emergency',
}
