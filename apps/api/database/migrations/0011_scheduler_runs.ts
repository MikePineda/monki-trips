import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bookkeeping of the in-process scheduler: one row per (job, run key), so two
 * containers of a start-first update never run the same slot twice.
 */
export default class extends BaseSchema {
  protected tableName = 'scheduler_runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.text('job').notNullable()
      table.text('run_key').notNullable()
      table.text('status').notNullable()
      table.timestamp('started_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('finished_at', { useTz: true }).nullable()

      table.check("status in ('running', 'done', 'failed')", [], 'scheduler_runs_status_check')
      table.unique(['job', 'run_key'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
