import type { EntitySpec } from '#services/sync/entity_spec'
import { expenseShareChanges } from '#validators/sync/entities'

/**
 * One share of a split, edited on its own. The expense's `shares` field
 * writes a whole split atomically and checks the sum; a single share has no
 * sum to check against (the other shares may be in the same batch), so the
 * split UI should send the whole split through the expense.
 */
export const expenseShareEntity: EntitySpec = {
  entity: 'expense_share',
  table: 'expense_shares',
  idColumn: 'id',
  tripColumn: 'trip_id',
  validator: expenseShareChanges,
  requiredOnInsert: ['expenseId', 'travellerId', 'shareMinor'],
  insertable: true,
  deletable: true,
  columns: [
    { field: 'id', column: 'id', type: 'text', writable: false },
    { field: 'tripId', column: 'trip_id', type: 'text', writable: false },
    {
      field: 'expenseId',
      column: 'expense_id',
      type: 'text',
      writable: true,
      immutable: true,
      references: 'expenses',
    },
    {
      field: 'travellerId',
      column: 'traveller_id',
      type: 'text',
      writable: true,
      references: 'travellers',
    },
    { field: 'shareMinor', column: 'share_minor', type: 'int', writable: true },
    { field: 'deletedAt', column: 'deleted_at', type: 'instant', writable: false },
    { field: 'updatedAt', column: 'updated_at', type: 'instant', writable: false },
  ],
}
