import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Budget lines. Syncable (S). Default categories carry a `key` the client
 * translates (accommodation, transport, food, activities, shopping, other);
 * custom ones carry a `name`.
 */
export default class extends BaseSchema {
  protected tableName = 'budget_categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.text('key').nullable()
      table.text('name').nullable()
      table.bigInteger('budget_minor').nullable()
      table.integer('position').notNullable().defaultTo(0)
      addSyncColumns(table, this.db.getWriteClient())

      table.check('key IS NOT NULL OR name IS NOT NULL', [], 'budget_categories_label_check')
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(
      `CREATE UNIQUE INDEX budget_categories_trip_key_live_uniq ON budget_categories (trip_id, key) WHERE deleted_at IS NULL AND key IS NOT NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
