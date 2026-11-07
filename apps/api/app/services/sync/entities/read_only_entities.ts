import vine from '@vinejs/vine'
import type { EntitySpec } from '#services/sync/entity_spec'

const noChanges = vine.compile(vine.object({}))

/** Memberships: read through pull, written by the members routes. The display name is joined in by pull. */
export const memberEntity: EntitySpec = {
  entity: 'member',
  table: 'trip_members',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: noChanges,
  requiredOnInsert: [],
  insertable: false,
  deletable: false,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'userId', column: 'user_id', type: 'text', writable: false },
    { field: 'role', column: 'role', type: 'text', writable: false },
    { field: 'displayName', column: 'display_name', type: 'text', writable: false },
    { field: 'joinedAt', column: 'joined_at', type: 'instant', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
}

/**
 * Phrase cards: written only by `POST /trips/:tripId/phrase-cards` (the LLM
 * generates them once per language), synced read-only to every device.
 */
export const phraseCardEntity: EntitySpec = {
  entity: 'phrase_card',
  table: 'phrase_cards',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: noChanges,
  requiredOnInsert: [],
  insertable: false,
  deletable: false,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'language', column: 'language', type: 'text', writable: false },
    { field: 'cards', column: 'cards', type: 'json', writable: false },
    { field: 'model', column: 'model', type: 'text', writable: false },
    { field: 'createdBy', column: 'created_by', type: 'text', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
}
