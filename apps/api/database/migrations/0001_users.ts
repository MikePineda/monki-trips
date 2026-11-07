import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Accounts. Enums are text + CHECK (never native enums) so later values are
 * additive. The e-mail is stored lowercase and the CHECK guarantees it.
 * `session_version` is bumped to revoke every session ("sign out
 * everywhere", password reset, disable). No platform role column: operations
 * run through `node ace users:*` commands.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('email').notNullable().unique()
      table.text('password').notNullable()
      table.text('display_name').notNullable()
      table.text('locale').notNullable().defaultTo('en')
      table.text('timezone').notNullable().defaultTo('UTC')
      table.text('theme').notNullable().defaultTo('system')
      table.timestamp('email_verified_at', { useTz: true }).nullable()
      table.integer('session_version').notNullable().defaultTo(1)
      table.text('status').notNullable().defaultTo('active')
      table.text('plan').notNullable().defaultTo('free')
      table.timestamp('deletion_scheduled_at', { useTz: true }).nullable()
      table.timestamp('last_login_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check('email = lower(email)', [], 'users_email_lowercase_check')
      table.check("locale in ('en', 'es')", [], 'users_locale_check')
      table.check("theme in ('system', 'light', 'dark')", [], 'users_theme_check')
      table.check("status in ('active', 'disabled')", [], 'users_status_check')
      table.check("plan in ('free', 'pro')", [], 'users_plan_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
