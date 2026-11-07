import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Idempotency log of `POST /sync/push`: `id` is the client's `mutationId`
 * and `response` the stored result a replay gets back. Purged at 30 days.
 */
export default class extends BaseSchema {
  protected tableName = 'sync_mutations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.text('status').notNullable()
      table.jsonb('response').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check(
        "status in ('applied', 'partial', 'duplicate', 'rejected')",
        [],
        'sync_mutations_status_check'
      )
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
