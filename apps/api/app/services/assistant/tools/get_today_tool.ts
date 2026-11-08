import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { toolData } from '#services/assistant/assistant_tool'
import { validateToolInput } from '#services/assistant/tool_input'
import { TripContent } from '#services/trip_content'
import { TripViews } from '#services/trip_views'
import { ASSISTANT_ADDRESS_MAX_CHARS } from '#config/assistant'
import { clipText } from '#domain/clip_text'

const input = vine.compile(
  vine.object({
    date: vine
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
)

/** The hour of a given day the Today view is computed for: the morning, before the day's plans. */
const MORNING = 'T07:00:00'

/**
 * The Today view of the app (shared `today_view`) for now or for a given
 * local day: next event with when to leave, the day's events and documents,
 * where we sleep, what is left to spend and the tasks by urgency, each with
 * its title so the model can answer "what do I need tomorrow".
 */
@inject()
export class GetTodayTool implements AssistantTool {
  readonly definition = {
    name: 'get_today',
    description:
      'What a day of the trip looks like, as the Today screen shows it: next event and when to leave for it, the events and documents of the day, where we sleep that night, money left to spend that day (base currency minor units) and tasks by urgency. Optional date (YYYY-MM-DD, local day of the trip); default now.',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Local day, YYYY-MM-DD' } },
      additionalProperties: false,
    },
  }

  constructor(
    private readonly content: TripContent,
    private readonly views: TripViews
  ) {}

  async run({ trip }: ToolContext, raw: Record<string, unknown>): Promise<ToolOutcome> {
    const { date } = await validateToolInput<{ date?: string }>(input, raw)
    const rows = await this.content.load(trip.id)
    let at: Date | undefined
    if (date) {
      const stop = rows.stops.find(
        (one) => one.tz && one.arriveOn && one.arriveOn <= date && (one.departOn ?? date) >= date
      )
      at = DateTime.fromISO(`${date}${MORNING}`, { zone: stop?.tz ?? trip.homeTz }).toJSDate()
    }
    const today = await this.views.today(trip, at)
    const events = new Map(rows.events.map((event) => [event.id, event]))
    const documents = new Map(rows.documents.map((document) => [document.id, document]))
    const tasks = new Map(rows.tasks.map((task) => [task.id, task]))
    return toolData(this.definition.name, {
      date: today.date,
      tz: today.tz,
      baseCurrency: trip.baseCurrency,
      nextEvent: today.nextEvent,
      events: today.todayEventIds.flatMap((id) => {
        const event = events.get(id)
        return event
          ? [
              {
                id,
                kind: event.kind,
                title: event.title,
                status: event.status,
                startsLocal: event.startsLocal,
                startTz: event.startTz,
                endsLocal: event.endsLocal,
                endTz: event.endTz,
                placeName: clipText(event.placeName, ASSISTANT_ADDRESS_MAX_CHARS),
              },
            ]
          : []
      }),
      documents: today.todayDocumentIds.flatMap((id) => {
        const document = documents.get(id)
        return document
          ? [{ id, title: document.title, tags: document.tags, offline: document.availableOffline }]
          : []
      }),
      sleepingAt: today.sleepingAt,
      leftTodayMinor: today.leftTodayMinor,
      tasks: today.tasks.flatMap(({ taskId, urgency }) => {
        const task = tasks.get(taskId)
        return task ? [{ id: taskId, title: task.title, dueOn: task.dueOn, urgency }] : []
      }),
    })
  }
}
