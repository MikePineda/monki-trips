import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Store of `@adonisjs/limiter` (database driver), as the package's own
 * migration stub defines it. Throttles on login, signup, forgot and verify
 * share it, prefixed by limiter name.
 */
export default class extends BaseSchema {
  protected tableName = 'rate_limits'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('key', 255).notNullable().primary()
      table.integer('points', 9).notNullable().defaultTo(0)
      table.bigint('expire').unsigned()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
