import type { Knex } from 'knex'

/**
 * The columns every syncable table carries ("S" in the plan's schema table)
 * and the trigger that stamps them. Pull pages by `(change_xid, change_seq)`;
 * `field_clock` holds the per-field last-write-wins clock; `deleted_at` is
 * the tombstone; `updated_by` points at the account that wrote the row.
 */
export const SYNC_COLUMNS = [
  'change_xid',
  'change_seq',
  'field_clock',
  'deleted_at',
  'updated_by',
  'created_at',
  'updated_at',
] as const

/** Adds the sync columns to a table being created. `users` must already exist. */
export function addSyncColumns(table: Knex.CreateTableBuilder, knex: Knex): void {
  table.specificType('change_xid', 'xid8')
  table.bigInteger('change_seq')
  table.jsonb('field_clock').notNullable().defaultTo('{}')
  table.timestamp('deleted_at', { useTz: true }).nullable()
  table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
}

/** SQL that installs the `sync_stamp()` trigger (migration 0000) on a table. */
export function syncTriggerSql(tableName: string): string {
  return `
    CREATE TRIGGER ${tableName}_sync_stamp
    BEFORE INSERT OR UPDATE ON ${tableName}
    FOR EACH ROW EXECUTE FUNCTION sync_stamp()
  `
}

/** SQL for the index pull reads from: the tenant column first, then the cursor. */
export function syncIndexSql(tableName: string, tenantColumn = 'trip_id'): string {
  return `CREATE INDEX ${tableName}_sync_cursor_idx ON ${tableName} (${tenantColumn}, change_xid, change_seq)`
}
