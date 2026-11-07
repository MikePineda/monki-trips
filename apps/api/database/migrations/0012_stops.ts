import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Places the trip stays at or passes through, in order. Syncable (S).
 * Coordinates are plain decimals; `tz` is the IANA zone Today follows there.
 */
export default class extends BaseSchema {
  protected tableName = 'stops'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.integer('position').notNullable().defaultTo(0)
      table.text('name').notNullable()
      table.specificType('country_code', 'char(2)').nullable()
      table.decimal('lat', 9, 6).nullable()
      table.decimal('lng', 9, 6).nullable()
      table.text('tz').nullable()
      table.date('arrive_on').nullable()
      table.date('depart_on').nullable()
      addSyncColumns(table, this.db.getWriteClient())

      table.check(
        'depart_on IS NULL OR arrive_on IS NULL OR depart_on >= arrive_on',
        [],
        'stops_dates_check'
      )
      table.check("country_code IS NULL OR country_code ~ '^[A-Z]{2}$'", [], 'stops_country_check')
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(`CREATE INDEX stops_trip_position_idx ON stops (trip_id, position)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
