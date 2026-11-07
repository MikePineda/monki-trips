import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Expenses in the currency they were paid in. Syncable (S). `fx_rate` is
 * units of `currency` per 1 base unit, fixed when known and never
 * recomputed; `base_amount_minor` is derived from it on the server and
 * stays NULL together with the rate until sync finds the rate of `spent_on`.
 */
export default class extends BaseSchema {
  protected tableName = 'expenses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table
        .uuid('category_id')
        .nullable()
        .references('id')
        .inTable('budget_categories')
        .onDelete('SET NULL')
      table.uuid('event_id').nullable().references('id').inTable('events').onDelete('SET NULL')
      table.bigInteger('amount_minor').notNullable()
      table.specificType('currency', 'char(3)').notNullable()
      table.decimal('fx_rate', 24, 10).nullable()
      table.date('fx_rate_date').nullable()
      table.text('fx_source').nullable()
      table.bigInteger('base_amount_minor').nullable()
      table.date('spent_on').notNullable()
      table.text('description').nullable()
      table
        .uuid('paid_by_traveller_id')
        .nullable()
        .references('id')
        .inTable('travellers')
        .onDelete('SET NULL')
      table.boolean('needs_details').notNullable().defaultTo(false)
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      addSyncColumns(table, this.db.getWriteClient())

      table.check('amount_minor <> 0', [], 'expenses_amount_check')
      table.check("currency ~ '^[A-Z]{3}$'", [], 'expenses_currency_check')
      table.check('(fx_rate IS NULL) = (base_amount_minor IS NULL)', [], 'expenses_fx_pair_check')
      table.check(
        "fx_source IS NULL OR fx_source in ('frankfurter', 'manual', 'identity')",
        [],
        'expenses_fx_source_check'
      )
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(`CREATE INDEX expenses_trip_spent_on_idx ON expenses (trip_id, spent_on)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
