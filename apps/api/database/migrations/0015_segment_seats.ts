import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * One traveller's seat on one segment (people on the same leg may hold
 * different tickets). Syncable (S). The `document_id` foreign key is added
 * by the documents migration, which comes next.
 */
export default class extends BaseSchema {
  protected tableName = 'segment_seats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('segment_id')
        .notNullable()
        .references('id')
        .inTable('event_segments')
        .onDelete('CASCADE')
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table
        .uuid('traveller_id')
        .notNullable()
        .references('id')
        .inTable('travellers')
        .onDelete('CASCADE')
      table.text('seat').nullable()
      table.text('coach').nullable()
      table.text('ticket_number').nullable()
      table.uuid('document_id').nullable()
      addSyncColumns(table, this.db.getWriteClient())
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(
      `CREATE UNIQUE INDEX segment_seats_segment_traveller_live_uniq ON segment_seats (segment_id, traveller_id) WHERE deleted_at IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
