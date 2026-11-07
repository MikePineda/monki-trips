import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Web Push subscriptions, one per browser (the endpoint is unique). Private
 * to their account: another member's subscription answers 404.
 */
export default class extends BaseSchema {
  protected tableName = 'push_subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('endpoint').notNullable().unique()
      table.text('p256dh').notNullable()
      table.text('auth').notNullable()
      table.text('device_label').nullable()
      table.integer('failures').notNullable().defaultTo(0)
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
