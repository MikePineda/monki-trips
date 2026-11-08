import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import type { TripEventRow } from '@monkitrips/shared'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { toolData } from '#services/assistant/assistant_tool'
import { validateToolInput } from '#services/assistant/tool_input'
import { TripContent } from '#services/trip_content'
import {
  ASSISTANT_ADDRESS_MAX_CHARS,
  ASSISTANT_MAX_LIST_ROWS,
  ASSISTANT_NOTES_MAX_CHARS,
} from '#config/assistant'
import { clipText } from '#domain/clip_text'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const input = vine.compile(
  vine.object({
    from: vine.string().regex(ISO_DATE).optional(),
    to: vine.string().regex(ISO_DATE).optional(),
  })
)

/** The local date an event ends on, else the one it starts on. */
function lastDay(event: TripEventRow): string | null {
  return event.endsLocal ? event.endsLocal.slice(0, 10) : event.startsOn
}

/**
 * Itinerary events, optionally only those overlapping a date range (local
 * dates, inclusive). Booking codes are left out: the model never needs
 * them to plan, and they stay between the member and the provider.
 */
@inject()
export class ListEventsTool implements AssistantTool {
  readonly definition = {
    name: 'list_events',
    description:
      'Events of the itinerary (flights, trains, lodging, tours, meals...) with local times and IANA zones, status and place. Optional from/to (YYYY-MM-DD, inclusive) keep only events overlapping those days. Transport legs are in segments.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'First local day, YYYY-MM-DD' },
        to: { type: 'string', description: 'Last local day, YYYY-MM-DD' },
      },
      additionalProperties: false,
    },
  }

  constructor(private readonly content: TripContent) {}

  async run({ trip }: ToolContext, raw: Record<string, unknown>): Promise<ToolOutcome> {
    const { from, to } = await validateToolInput<{ from?: string; to?: string }>(input, raw)
    const rows = await this.content.load(trip.id)
    const ranged = from !== undefined || to !== undefined
    const events = rows.events.filter((event) => {
      if (!ranged) return true
      if (!event.startsOn) return false
      const end = lastDay(event) ?? event.startsOn
      return (to === undefined || event.startsOn <= to) && (from === undefined || end >= from)
    })
    return toolData(this.definition.name, {
      events: events.slice(0, ASSISTANT_MAX_LIST_ROWS).map((event) => ({
        id: event.id,
        kind: event.kind,
        title: event.title,
        status: event.status,
        stopId: event.stopId,
        startsLocal: event.startsLocal,
        startTz: event.startTz,
        endsLocal: event.endsLocal,
        endTz: event.endTz,
        placeName: clipText(event.placeName, ASSISTANT_ADDRESS_MAX_CHARS),
        address: clipText(event.address, ASSISTANT_ADDRESS_MAX_CHARS),
        providerName: event.providerName,
        costMinor: event.costMinor,
        costCurrency: event.costCurrency,
        leaveBufferMin: event.leaveBufferMin,
        travelMin: event.travelMin,
        notes: clipText(event.notes, ASSISTANT_NOTES_MAX_CHARS),
        segments: rows.segments
          .filter((segment) => segment.eventId === event.id)
          .map((segment) => ({
            carrier: segment.carrier,
            number: segment.number,
            originName: segment.originName,
            destName: segment.destName,
            departsLocal: segment.departsLocal,
            departsTz: segment.departsTz,
            arrivesLocal: segment.arrivesLocal,
            arrivesTz: segment.arrivesTz,
          })),
      })),
      truncated: events.length > ASSISTANT_MAX_LIST_ROWS,
    })
  }
}
