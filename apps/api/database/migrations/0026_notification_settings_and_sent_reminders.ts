import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Push reminders (WP 2.7b). `notification_settings` holds one row per
 * account that changed a default: no row means every reminder on and no
 * quiet hours. `sent_reminders` is the ledger the `push:reminders` job
 * writes BEFORE sending: the unique key `(user_id, kind, ref_id, fire_at)`
 * makes a reminder go out once across every replica. New tables only.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('notification_settings', (table) => {
      table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE')
      table.boolean('leave_at').notNullable().defaultTo(true)
      table.boolean('check_out').notNullable().defaultTo(true)
      table.boolean('tasks_due').notNullable().defaultTo(true)
      // Local wall clock `HH:MM`; both set or both null (validated on input, checked here too).
      table.text('quiet_hours_start').nullable()
      table.text('quiet_hours_end').nullable()
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check(
        '(quiet_hours_start is null) = (quiet_hours_end is null)',
        [],
        'notification_settings_quiet_hours_pair_check'
      )
    })

    this.schema.createTable('sent_reminders', (table) => {
      table.bigIncrements('id')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.text('kind').notNullable()
      table.text('ref_id').notNullable()
      table.timestamp('fire_at', { useTz: true }).notNullable()
      table.timestamp('sent_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['user_id', 'kind', 'ref_id', 'fire_at'])
      table.index(['trip_id'])
      table.index(['sent_at'])
    })
  }

  async down() {
    this.schema.dropTable('sent_reminders')
    this.schema.dropTable('notification_settings')
  }
}
