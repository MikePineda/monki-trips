import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per LLM call, for the per-user monthly token cap and for cost
 * tracking. Kept when the account or trip goes (SET NULL): usage is a fact
 * about the deployment, not personal content.
 */
export default class extends BaseSchema {
  protected tableName = 'llm_usage'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.uuid('trip_id').nullable().references('id').inTable('trips').onDelete('SET NULL')
      table.text('purpose').notNullable()
      table.text('provider').notNullable()
      table.text('model').notNullable()
      table.integer('tokens_in').notNullable().defaultTo(0)
      table.integer('tokens_out').notNullable().defaultTo(0)
      table.integer('latency_ms').nullable()
      table.text('status').notNullable()
      table.bigInteger('cost_micros').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check(
        "purpose in ('chat', 'extract_booking', 'phrase_cards')",
        [],
        'llm_usage_purpose_check'
      )
      table.check("status in ('ok', 'error', 'quota_exceeded')", [], 'llm_usage_status_check')
      table.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
