import { EMERGENCY_INFO_KEYS, EMERGENCY_INFO_SCHEMA_VERSION } from '@monkitrips/shared'
import type { EntitySpec } from '#services/sync/entity_spec'
import { emergencyChanges } from '#validators/sync/entities'

/**
 * Emergency information: one row per trip, keyed by the trip id (the
 * mutation's `id` must equal its `tripId`). Each top-level key of `content`
 * is a field of its own for last-write-wins; the applier folds them into the
 * jsonb column. Never deleted, never logged.
 */
export const emergencyEntity: EntitySpec = {
  entity: 'emergency',
  table: 'emergency_info',
  idColumn: 'trip_id',
  tripColumn: 'trip_id',
  validator: emergencyChanges,
  requiredOnInsert: [],
  insertable: true,
  deletable: false,
  columns: [
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'content', column: 'content', type: 'json', writable: false },
    { field: 'schemaVersion', column: 'schema_version', type: 'int', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
    // The content keys are virtual fields: merged by the applier into `content`.
    ...EMERGENCY_INFO_KEYS.map((key) => ({
      field: key,
      column: `content.${key}`,
      type: 'json' as const,
      writable: true,
    })),
  ],
  async derive(_merged, ctx) {
    return {
      columns: ctx.inserting ? { schema_version: EMERGENCY_INFO_SCHEMA_VERSION } : {},
      problems: [],
    }
  },
}
