import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncTriggerSql } from '../sync_columns.js'

/**
 * Emergency information, one row per trip (`trip_id` is the key). Syncable
 * (S): last-write-wins runs per top-level key of `content`. Never logged.
 */
export default class extends BaseSchema {
  protected tableName = 'emergency_info'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('trip_id').primary().references('id').inTable('trips').onDelete('CASCADE')
      table.jsonb('content').notNullable().defaultTo('{}')
      table.integer('schema_version').notNullable().defaultTo(1)
      addSyncColumns(table, this.db.getWriteClient())
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(
      `CREATE INDEX emergency_info_sync_cursor_idx ON emergency_info (trip_id, change_xid, change_seq)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
