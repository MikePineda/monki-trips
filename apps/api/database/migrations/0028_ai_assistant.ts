import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The trip assistant (WP 3.1). New tables only, plus one column with a
 * default, so a previous version keeps running beside this one:
 *
 * - `ai_conversations`: a chat about one trip, private to the account that
 *   started it (`user_id`); hard-deleted by its creator.
 * - `ai_messages`: the member's messages and the assistant's answers, as
 *   display text (tool calls and their payloads are not kept).
 * - `ai_actions`: every proposal a write tool made, with the diff the
 *   member sees (`proposal`), the exact sync mutations accepting it pushes
 *   (`mutations`) and the change stamps of the rows it touches
 *   (`baseline`), so an accept after a conflicting change answers 409.
 * - `trip_activity.via`: `app` for writes the member made, `assistant` for
 *   writes an accepted proposal made in the member's name.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('ai_conversations', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('title').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['trip_id', 'user_id', 'updated_at'])
    })

    this.schema.createTable('ai_messages', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('conversation_id')
        .notNullable()
        .references('id')
        .inTable('ai_conversations')
        .onDelete('CASCADE')
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      // Insertion order: a turn writes its two messages within the same instant.
      table.specificType('seq', 'bigint generated always as identity').notNullable()
      table.text('role').notNullable()
      table.text('content').notNullable().defaultTo('')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check("role in ('user', 'assistant')", [], 'ai_messages_role_check')
      table.index(['conversation_id', 'seq'])
    })

    this.schema.createTable('ai_actions', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('trip_id').notNullable().references('id').inTable('trips').onDelete('CASCADE')
      table
        .uuid('conversation_id')
        .notNullable()
        .references('id')
        .inTable('ai_conversations')
        .onDelete('CASCADE')
      table
        .uuid('message_id')
        .nullable()
        .references('id')
        .inTable('ai_messages')
        .onDelete('SET NULL')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.specificType('seq', 'bigint generated always as identity').notNullable()
      table.text('tool').notNullable()
      table.text('status').notNullable().defaultTo('proposed')
      table.jsonb('proposal').notNullable()
      table.jsonb('mutations').notNullable().defaultTo('[]')
      table.jsonb('baseline').notNullable().defaultTo('[]')
      table.text('error_code').nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('decided_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check(
        "status in ('proposed', 'accepted', 'rejected', 'expired', 'failed')",
        [],
        'ai_actions_status_check'
      )
      table.check(
        "tool in ('propose_event_changes', 'add_expense', 'create_task')",
        [],
        'ai_actions_tool_check'
      )
      table.index(['trip_id', 'status'])
      table.index(['conversation_id', 'seq'])
    })

    this.schema.alterTable('trip_activity', (table) => {
      table.text('via').notNullable().defaultTo('app')
      table.check("via in ('app', 'assistant')", [], 'trip_activity_via_check')
    })
  }

  async down() {
    this.schema.alterTable('trip_activity', (table) => {
      table.dropChecks(['trip_activity_via_check'])
      table.dropColumn('via')
    })
    this.schema.dropTable('ai_actions')
    this.schema.dropTable('ai_messages')
    this.schema.dropTable('ai_conversations')
  }
}
