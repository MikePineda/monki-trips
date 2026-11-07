import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Who belongs to a trip and as what. Exactly one live owner per trip
 * (partial unique index); a person is a live member once (partial unique on
 * trip + user, so a removed member can be invited again).
 */
export default class extends BaseSchema {
  protected tableName = 'trip_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('role').notNullable()
      table.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(this.now())
      addSyncColumns(table, this.db.getWriteClient())

      table.check("role in ('owner', 'editor')", [], 'trip_members_role_check')
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(
      `CREATE UNIQUE INDEX trip_members_trip_user_live_uniq ON trip_members (trip_id, user_id) WHERE deleted_at IS NULL`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX trip_members_one_owner_uniq ON trip_members (trip_id) WHERE role = 'owner' AND deleted_at IS NULL`
    )
    this.schema.raw(`CREATE INDEX trip_members_user_idx ON trip_members (user_id)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
