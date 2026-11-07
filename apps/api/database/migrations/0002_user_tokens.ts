import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Single-use tokens sent by mail: e-mail verification (link + 6-digit code)
 * and password reset (link). Only sha256 hashes are stored; `attempts`
 * counts wrong codes.
 */
export default class extends BaseSchema {
  protected tableName = 'user_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('purpose').notNullable()
      table.text('token_hash').notNullable().unique()
      table.text('code_hash').nullable()
      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check("purpose in ('verify_email', 'reset_password')", [], 'user_tokens_purpose_check')
      table.index(['user_id', 'purpose'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
