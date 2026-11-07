import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Tasks of a trip. Syncable (S). `title_key` names a translation for tasks
 * the server creates (the print task of a `print` document, template
 * items); one open print task per document and one task per template item.
 */
export default class extends BaseSchema {
  protected tableName = 'tasks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.uuid('event_id').nullable().references('id').inTable('events').onDelete('SET NULL')
      table.text('title').notNullable()
      table.text('title_key').nullable()
      table.text('notes').nullable()
      table.date('due_on').nullable()
      table.text('priority').notNullable().defaultTo('normal')
      table.timestamp('done_at', { useTz: true }).nullable()
      table.uuid('done_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.text('origin').notNullable().defaultTo('manual')
      table
        .uuid('source_document_id')
        .nullable()
        .references('id')
        .inTable('documents')
        .onDelete('SET NULL')
      table.text('template_item_key').nullable()
      addSyncColumns(table, this.db.getWriteClient())

      table.check("priority in ('low', 'normal', 'high')", [], 'tasks_priority_check')
      table.check("origin in ('manual', 'template', 'document', 'ai')", [], 'tasks_origin_check')
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(
      `CREATE UNIQUE INDEX tasks_source_document_live_uniq ON tasks (source_document_id) WHERE deleted_at IS NULL AND origin = 'document'`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX tasks_trip_template_item_live_uniq ON tasks (trip_id, template_item_key) WHERE deleted_at IS NULL AND template_item_key IS NOT NULL`
    )
    this.schema.raw(`CREATE INDEX tasks_trip_due_on_idx ON tasks (trip_id, due_on)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
