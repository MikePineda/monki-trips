import { BaseSchema } from '@adonisjs/lucid/schema'
import { addSyncColumns, syncIndexSql, syncTriggerSql } from '../sync_columns.js'

/**
 * Document metadata (the bytes live in object storage under
 * `trips/{tripId}/{documentId}`). Syncable (S). A `file` has a storage key,
 * a `link` has a URL; tags are limited to the three the app understands.
 * Also links `segment_seats.document_id` to this table.
 */
export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.uuid('event_id').nullable().references('id').inTable('events').onDelete('SET NULL')
      table.text('kind').notNullable()
      table.text('title').notNullable()
      table.text('url').nullable()
      table.text('storage_key').nullable()
      table.text('mime').nullable()
      table.bigInteger('size_bytes').nullable()
      table.text('sha256').nullable()
      table.specificType('tags', 'text[]').notNullable().defaultTo('{}')
      table.boolean('available_offline').notNullable().defaultTo(false)
      table.uuid('uploaded_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      addSyncColumns(table, this.db.getWriteClient())

      table.check("kind in ('file', 'link')", [], 'documents_kind_check')
      table.check(
        "tags <@ ARRAY['print', 'show_on_phone', 'requires_passport']::text[]",
        [],
        'documents_tags_check'
      )
      table.check(
        "(kind = 'file' AND storage_key IS NOT NULL) OR (kind = 'link' AND url IS NOT NULL)",
        [],
        'documents_kind_payload_check'
      )
    })
    this.schema.raw(syncTriggerSql(this.tableName))
    this.schema.raw(syncIndexSql(this.tableName))
    this.schema.raw(
      `ALTER TABLE segment_seats ADD CONSTRAINT segment_seats_document_id_foreign FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE SET NULL`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE segment_seats DROP CONSTRAINT segment_seats_document_id_foreign`)
    this.schema.dropTable(this.tableName)
  }
}
