import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `llm_usage.status` gains `pending` (a call in flight, its row reserving
 * the estimated input plus `maxTokens` against the cap until it settles)
 * and `aborted` (a stream the consumer stopped early). Widening only: a
 * previous version still writes `ok`, `error` and `quota_exceeded`, so
 * both run side by side during a start-first update.
 */
export default class extends BaseSchema {
  protected tableName = 'llm_usage'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['llm_usage_status_check'])
      table.check(
        "status in ('ok', 'error', 'quota_exceeded', 'pending', 'aborted')",
        [],
        'llm_usage_status_check'
      )
    })
  }

  async down() {
    this.schema.raw(
      `update ${this.tableName} set status = 'error' where status in ('pending', 'aborted')`
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['llm_usage_status_check'])
      table.check("status in ('ok', 'error', 'quota_exceeded')", [], 'llm_usage_status_check')
    })
  }
}
