import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cache of exchange rates by day: units of `quote` per 1 `base` on
 * `rate_on`. Not syncable: the client gets rates through `GET /fx/rates`
 * and stores the one it used on the expense.
 */
export default class extends BaseSchema {
  protected tableName = 'fx_rates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.specificType('base', 'char(3)').notNullable()
      table.specificType('quote', 'char(3)').notNullable()
      table.date('rate_on').notNullable()
      table.decimal('rate', 24, 10).notNullable()
      table.text('source').notNullable()
      table.timestamp('fetched_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.primary(['base', 'quote', 'rate_on'])
      table.check("source in ('frankfurter', 'manual', 'identity')", [], 'fx_rates_source_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
