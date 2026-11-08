import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { toolData } from '#services/assistant/assistant_tool'
import { validateToolInput } from '#services/assistant/tool_input'
import { Clock } from '#services/clock'
import { TripContent } from '#services/trip_content'
import { taskUrgency } from '#domain/task_urgency'
import { ASSISTANT_MAX_LIST_ROWS } from '#config/assistant'

const input = vine.compile(vine.object({ includeDone: vine.boolean().optional() }))

/** The trip's tasks with their urgency today (shared `task_urgency` rules); open ones unless asked. */
@inject()
export class ListTasksTool implements AssistantTool {
  readonly definition = {
    name: 'list_tasks',
    description:
      'Tasks of the trip with due date, priority and urgency today (overdue, today, this_week, later, no_date). Done tasks only with includeDone.',
    inputSchema: {
      type: 'object',
      properties: { includeDone: { type: 'boolean' } },
      additionalProperties: false,
    },
  }

  constructor(
    private readonly content: TripContent,
    private readonly clock: Clock
  ) {}

  async run({ trip }: ToolContext, raw: Record<string, unknown>): Promise<ToolOutcome> {
    const { includeDone } = await validateToolInput<{ includeDone?: boolean }>(input, raw)
    const { tasks } = await this.content.load(trip.id)
    const today = DateTime.fromJSDate(this.clock.now()).setZone(trip.homeTz).toISODate()!
    const listed = tasks.filter((task) => includeDone || task.doneAt === null)
    return toolData(this.definition.name, {
      today,
      tasks: listed.slice(0, ASSISTANT_MAX_LIST_ROWS).map((task) => ({
        id: task.id,
        title: task.title,
        titleKey: task.titleKey,
        notes: task.notes,
        dueOn: task.dueOn,
        priority: task.priority,
        eventId: task.eventId,
        done: task.doneAt !== null,
        urgency: task.doneAt === null ? taskUrgency(task.dueOn, today) : null,
      })),
      truncated: listed.length > ASSISTANT_MAX_LIST_ROWS,
    })
  }
}
