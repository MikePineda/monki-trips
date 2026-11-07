import type { EntitySpec } from '#services/sync/entity_spec'
import { tripChanges } from '#validators/sync/entities'

/**
 * The trip row itself through push: name, dates, budget and home zone.
 * `baseCurrency` is owner-only and locked once expenses exist (the applier
 * enforces both). Trips are created by `POST /trips` and deleted by
 * `DELETE /trips/:tripId`, never by push.
 */
export const tripEntity: EntitySpec = {
  entity: 'trip',
  table: 'trips',
  idColumn: 'id',
  tripColumn: 'id',
  validator: tripChanges,
  requiredOnInsert: [],
  insertable: false,
  deletable: false,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'name', column: 'name', type: 'text', writable: true },
    { field: 'baseCurrency', column: 'base_currency', type: 'text', writable: true },
    { field: 'budgetMode', column: 'budget_mode', type: 'text', writable: true },
    { field: 'budgetTotalMinor', column: 'budget_total_minor', type: 'int', writable: true },
    { field: 'startsOn', column: 'starts_on', type: 'date', writable: true },
    { field: 'endsOn', column: 'ends_on', type: 'date', writable: true },
    { field: 'homeTz', column: 'home_tz', type: 'text', writable: true },
    { field: 'createdBy', column: 'created_by', type: 'text', writable: false },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'createdAt', column: 'created_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async derive(merged) {
    const problems = []
    if (
      typeof merged.startsOn === 'string' &&
      typeof merged.endsOn === 'string' &&
      merged.endsOn < merged.startsOn
    ) {
      problems.push({ field: 'endsOn', rule: 'afterOrEqual' })
    }
    return { columns: {}, problems }
  },
}
