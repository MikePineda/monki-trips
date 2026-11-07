import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Itinerary events. Syncable (S). Local times travel with their IANA zone;
 * the `*_at` instants and `starts_on` are derived on the server. The only
 * order check is in UTC: a flight that lands "before" it departed on the
 * local clock is valid. A hotel stay is one `lodging` event.
 */
export default class extends BaseSchema {
  protected tableName = 'events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.uuid('stop_id').nullable().references('id').inTable('stops').onDelete('SET NULL')
      table.text('kind').notNullable()
      table.text('title').notNullable()
      table.text('status').notNullable().defaultTo('idea')
      table.timestamp('starts_local', { useTz: false }).nullable()
      table.text('start_tz').nullable()
      table.timestamp('starts_at', { useTz: true }).nullable()
      table.date('starts_on').nullable()
      table.timestamp('ends_local', { useTz: false }).nullable()
      table.text('end_tz').nullable()
      table.timestamp('ends_at', { useTz: true }).nullable()
      table.text('place_name').nullable()
      table.text('address').nullable()
      table.text('address_local').nullable()
      table.decimal('lat', 9, 6).nullable()
      table.decimal('lng', 9, 6).nullable()
      table.text('provider_name').nullable()
      table.text('booking_code').nullable()
      table.bigInteger('cost_minor').nullable()
      table.specificType('cost_currency', 'char(3)').nullable()
      table.text('notes').nullable()
      table.integer('leave_buffer_min').nullable()
      table.integer('travel_min').nullable()
      table.boolean('covers_night').nullable()
      addSyncColumns(table, this.db.getWriteClient())

      table.check(
        "kind in ('flight', 'train', 'ferry', 'bus', 'car', 'lodging', 'tour', 'meal', 'activity', 'free_time', 'other')",
        [],
        'events_kind_check'
      )
      table.check(
        "status in ('idea', 'to_book', 'booked', 'paid', 'cancelled')",
        [],
        'events_status_check'
      )
      table.check('(cost_minor IS NULL) = (cost_currency IS NULL)', [], 'events_cost_pair_check')
      table.check(
        "cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$'",
        [],
        'events_cost_currency_check'
      )
      table.check(
        'starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at',
        [],
        'events_order_check'
      )
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(`CREATE INDEX events_trip_starts_at_idx ON events (trip_id, starts_at)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
