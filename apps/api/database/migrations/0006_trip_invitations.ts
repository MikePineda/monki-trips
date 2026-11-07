import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Invitations to join a trip, by link (`email` null) or by e-mail. The
 * plaintext token is shown once; only its sha256 is stored. Single use:
 * `accepted_at` or `revoked_at` ends it, `expires_at` is creation + 7 days.
 */
export default class extends BaseSchema {
  protected tableName = 'trip_invitations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.text('email').nullable()
      table.text('token_hash').notNullable().unique()
      table.text('role').notNullable().defaultTo('editor')
      table.uuid('invited_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('accepted_at', { useTz: true }).nullable()
      table.uuid('accepted_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check("role in ('editor')", [], 'trip_invitations_role_check')
      table.check('email is null or email = lower(email)', [], 'trip_invitations_email_lowercase_check')
      table.index(['trip_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
