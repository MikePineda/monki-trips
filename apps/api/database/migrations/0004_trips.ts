import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncTriggerSql } from '../sync_columns.js'

/**
 * The tenant boundary. Syncable (S): soft-deleted with `deleted_at`,
 * restorable until `purge_after`. Money is integer minor units of
 * `base_currency`; dates are plain dates in `home_tz`.
 */
export default class extends BaseSchema {
  protected tableName = 'trips'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('name').notNullable()
      table.specificType('base_currency', 'char(3)').notNullable()
      table.text('budget_mode').notNullable().defaultTo('shared')
      table.bigInteger('budget_total_minor').nullable()
      table.date('starts_on').notNullable()
      table.date('ends_on').notNullable()
      table.text('home_tz').notNullable().defaultTo('UTC')
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('purge_after', { useTz: true }).nullable()
      addSyncColumns(table, this.db.getWriteClient())

      table.check('ends_on >= starts_on', [], 'trips_dates_check')
      table.check("base_currency ~ '^[A-Z]{3}$'", [], 'trips_base_currency_check')
      table.check("budget_mode in ('shared', 'split')", [], 'trips_budget_mode_check')
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(`CREATE INDEX trips_sync_cursor_idx ON trips (change_xid, change_seq)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
