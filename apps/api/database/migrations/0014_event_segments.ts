import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Legs of a transport event (two flights with a change, a train with a
 * connection). Syncable (S). When present they derive the event's start and
 * end; each leg has its own departure and arrival zone.
 */
export default class extends BaseSchema {
  protected tableName = 'event_segments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE')
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.integer('position').notNullable().defaultTo(0)
      table.text('carrier').nullable()
      table.text('number').nullable()
      table.text('origin_name').nullable()
      table.text('origin_code').nullable()
      table.decimal('origin_lat', 9, 6).nullable()
      table.decimal('origin_lng', 9, 6).nullable()
      table.text('dest_name').nullable()
      table.text('dest_code').nullable()
      table.decimal('dest_lat', 9, 6).nullable()
      table.decimal('dest_lng', 9, 6).nullable()
      table.timestamp('departs_local', { useTz: false }).notNullable()
      table.text('departs_tz').notNullable()
      table.timestamp('departs_at', { useTz: true }).notNullable()
      table.timestamp('arrives_local', { useTz: false }).notNullable()
      table.text('arrives_tz').notNullable()
      table.timestamp('arrives_at', { useTz: true }).notNullable()
      addSyncColumns(table, this.db.getWriteClient())

      table.check('arrives_at >= departs_at', [], 'event_segments_order_check')
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(
      `CREATE UNIQUE INDEX event_segments_event_position_live_uniq ON event_segments (event_id, position) WHERE deleted_at IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
