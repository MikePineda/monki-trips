import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Who owes what of an expense (split mode; schema from the start, UI in a
 * later phase). Syncable (S). The live shares of an expense sum to its
 * amount; the service validates it when a whole split is written.
 */
export default class extends BaseSchema {
  protected tableName = 'expense_shares'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('expense_id')
        .notNullable()
        .references('id')
        .inTable('expenses')
        .onDelete('CASCADE')
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table
        .uuid('traveller_id')
        .notNullable()
        .references('id')
        .inTable('travellers')
        .onDelete('CASCADE')
      table.bigInteger('share_minor').notNullable()
      addSyncColumns(table, this.db.getWriteClient())
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(
      `CREATE UNIQUE INDEX expense_shares_expense_traveller_live_uniq ON expense_shares (expense_id, traveller_id) WHERE deleted_at IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
