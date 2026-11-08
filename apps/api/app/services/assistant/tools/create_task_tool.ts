import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import { TASK_PRIORITIES, type AiTaskProposal, type SyncMutation } from '@monkitrips/shared'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { toolData } from '#services/assistant/assistant_tool'
import { MutationDryRun } from '#services/assistant/mutation_dry_run'
import { ProposalRecorder } from '#services/assistant/proposal_recorder'
import { validateToolInput } from '#services/assistant/tool_input'
import { Clock } from '#services/clock'

const input = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(200),
    dueOn: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    priority: vine.enum(TASK_PRIORITIES).optional(),
    notes: vine.string().trim().minLength(1).maxLength(2000).optional(),
    eventId: vine.string().uuid().optional(),
  })
)

interface TaskInput {
  title: string
  dueOn?: string
  priority?: (typeof TASK_PRIORITIES)[number]
  notes?: string
  eventId?: string
}

/** Drafts a task (origin `ai` once accepted), checked through the sync entity in a rolled-back dry run. */
@inject()
export class CreateTaskTool implements AssistantTool {
  readonly definition = {
    name: 'create_task',
    description:
      'Propose a task for the member to accept: title, optional due date (YYYY-MM-DD), priority (low, normal, high), notes and the id of the event it belongs to.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        dueOn: { type: 'string', description: 'YYYY-MM-DD' },
        priority: { type: 'string', enum: [...TASK_PRIORITIES] },
        notes: { type: 'string' },
        eventId: { type: 'string' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  }

  constructor(
    private readonly dryRun: MutationDryRun,
    private readonly recorder: ProposalRecorder,
    private readonly clock: Clock
  ) {}

  async run(ctx: ToolContext, raw: Record<string, unknown>): Promise<ToolOutcome> {
    const task = await validateToolInput<TaskInput>(input, raw)
    const mutation: SyncMutation = {
      mutationId: randomUUID(),
      tripId: ctx.trip.id,
      entity: 'task',
      op: 'upsert',
      id: randomUUID(),
      changes: {
        title: task.title,
        dueOn: task.dueOn ?? null,
        priority: task.priority ?? 'normal',
        notes: task.notes ?? null,
        eventId: task.eventId ?? null,
      },
      changedAt: this.clock.now().toISOString(),
    }
    const { after, baseline } = await this.dryRun.run(ctx.user, ctx.trip, ctx.i18n, () => [
      mutation,
    ])
    const row = after.tasks.find((one) => one.id === mutation.id)!
    const proposal: AiTaskProposal = {
      kind: 'task',
      taskId: row.id,
      title: row.title,
      dueOn: row.dueOn,
      priority: row.priority,
      notes: row.notes,
      eventId: row.eventId,
    }
    const action = await this.recorder.record(ctx, 'create_task', proposal, [mutation], baseline)
    return { ...toolData(this.definition.name, ProposalRecorder.forModel(action)), action }
  }
}
