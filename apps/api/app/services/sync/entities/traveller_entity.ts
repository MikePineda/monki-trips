import type { EntitySpec } from '#services/sync/entity_spec'
import { travellerChanges } from '#validators/sync/entities'

/**
 * People who travel. A traveller linked to an account (`userId`) is created
 * when the account joins and is never deleted through push; people without
 * an account are free content.
 */
export const travellerEntity: EntitySpec = {
  entity: 'traveller',
  table: 'travellers',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: travellerChanges,
  requiredOnInsert: ['displayName'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'displayName', column: 'display_name', type: 'text', writable: true },
    { field: 'userId', column: 'user_id', type: 'text', writable: false },
    { field: 'position', column: 'position', type: 'int', writable: true },
    { field: 'createdAt', column: 'created_at', type: 'instant', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
}
