import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Who changed what, for the activity screen: entity, row id, action and the
 * names of the fields that changed. Field names only, never values, so a
 * booking code or an emergency contact never lands here.
 */
export default class extends BaseSchema {
  protected tableName = 'trip_activity'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.uuid('actor_user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.text('entity').notNullable()
      table.uuid('entity_id').notNullable()
      table.text('action').notNullable()
      table.specificType('fields', 'text[]').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check("action in ('created', 'updated', 'deleted')", [], 'trip_activity_action_check')
      table.index(['trip_id', 'id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
