import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * People who travel, with or without an account. The owner and everyone who
 * accepts an invitation get one; an account appears once per trip (partial
 * unique index), people without an account are only limited by position.
 */
export default class extends BaseSchema {
  protected tableName = 'travellers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.text('display_name').notNullable()
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('position').notNullable().defaultTo(0)
      addSyncColumns(table, this.db.getWriteClient())
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(
      `CREATE UNIQUE INDEX travellers_trip_user_live_uniq ON travellers (trip_id, user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
