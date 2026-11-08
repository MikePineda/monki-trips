import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Reading a booking (WP 3.3). A proposal can now come from a document's
 * detail instead of a chat, so `ai_actions.conversation_id` becomes
 * nullable and `extract_booking` joins the tools the CHECK allows. Both
 * only widen what is accepted: the previous version keeps writing rows
 * with a conversation and one of the three older tools, and it never reads
 * an action outside a conversation (it lists actions by `conversation_id`).
 *
 * The CHECK is replaced, not dropped first and re-added later, inside the
 * migration's transaction, so no row can slip in without it.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ai_actions', (table) => {
      table.setNullable('conversation_id')
      table.dropChecks(['ai_actions_tool_check'])
      table.check(
        "tool in ('propose_event_changes', 'add_expense', 'create_task', 'extract_booking')",
        [],
        'ai_actions_tool_check'
      )
    })
  }

  async down() {
    // The older CHECK cannot hold these rows: they go first. Rows without a
    // conversation are all extract_booking ones; the column stays nullable.
    this.defer(async (database) => {
      await database.from('ai_actions').where('tool', 'extract_booking').delete()
    })
    this.schema.alterTable('ai_actions', (table) => {
      table.dropChecks(['ai_actions_tool_check'])
      table.check(
        "tool in ('propose_event_changes', 'add_expense', 'create_task')",
        [],
        'ai_actions_tool_check'
      )
    })
  }
}
