import type { EntitySpec } from '#services/sync/entity_spec'
import { budgetCategoryChanges } from '#validators/sync/entities'

/** Budget lines: a translated default (`key`) or a custom one (`name`); one of the two is required. */
export const budgetCategoryEntity: EntitySpec = {
  entity: 'budget_category',
  table: 'budget_categories',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: budgetCategoryChanges,
  requiredOnInsert: [],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    { field: 'key', column: 'key', type: 'text', writable: true },
    { field: 'name', column: 'name', type: 'text', writable: true },
    { field: 'budgetMinor', column: 'budget_minor', type: 'int', writable: true },
    { field: 'position', column: 'position', type: 'int', writable: true },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
  async derive(merged) {
    const problems = []
    if (!merged.key && !merged.name) problems.push({ field: 'name', rule: 'required' })
    return { columns: {}, problems }
  },
}
