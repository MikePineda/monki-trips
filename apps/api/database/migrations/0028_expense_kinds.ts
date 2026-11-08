import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * What an expense is: money spent (`expense`, every row so far) or a
 * transfer between travellers that settles a split (`settlement`). Set on
 * insert and never changed; budgets, Today and the mascot leave
 * settlements out, balances count them. Additive: existing rows become
 * `expense` through the default.
 */
export default class extends BaseSchema {
  protected tableName = 'expenses'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('kind').notNullable().defaultTo('expense')
      table.check("kind in ('expense', 'settlement')", [], 'expenses_kind_check')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['expenses_kind_check'])
      table.dropColumn('kind')
    })
  }
}
