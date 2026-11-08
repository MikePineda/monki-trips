import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { AiAction, AiActionTool, AiProposal, SyncMutation } from '@monkitrips/shared'
import type { ToolContext } from '#services/assistant/assistant_tool'
import { aiActionWire } from '#services/assistant/ai_action_wire'
import type { BaselineRow } from '#services/assistant/mutation_dry_run'
import { Clock } from '#services/clock'
import { AI_ACTION_TTL_MS } from '#config/assistant'

/**
 * Stores what a write tool proposes as an `ai_actions` row in `proposed`:
 * the diff the member sees, the exact mutations accepting it pushes and the
 * change stamps of the rows it touches. This is the only write a tool call
 * makes; trip content stays as it is until the member accepts.
 */
@inject()
export class ProposalRecorder {
  constructor(private readonly clock: Clock) {}

  async record(
    ctx: ToolContext,
    tool: AiActionTool,
    proposal: AiProposal,
    mutations: SyncMutation[],
    baseline: BaselineRow[]
  ): Promise<AiAction> {
    const now = this.clock.now()
    const [row] = (await db
      .table('ai_actions')
      .insert({
        trip_id: ctx.trip.id,
        conversation_id: ctx.conversationId,
        message_id: ctx.messageId,
        user_id: ctx.user.id,
        tool,
        status: 'proposed',
        proposal: JSON.stringify(proposal),
        mutations: JSON.stringify(mutations),
        baseline: JSON.stringify(baseline),
        expires_at: new Date(now.getTime() + AI_ACTION_TTL_MS),
        created_at: now,
        updated_at: now,
      })
      .returning('*')) as Record<string, unknown>[]
    return aiActionWire(row)
  }

  /** What the model reads back about a proposal it made. */
  static forModel(action: AiAction): Record<string, unknown> {
    return {
      actionId: action.id,
      status: action.status,
      note: 'Nothing is written yet: the member accepts or rejects this proposal in the app.',
      diff: action.proposal,
    }
  }
}
