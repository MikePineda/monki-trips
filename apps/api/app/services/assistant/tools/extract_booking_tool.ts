import type { AssistantTool, ToolOutcome } from '#services/assistant/assistant_tool'

/** Reading a booking PDF or photo into events arrives with WP 3.3; until then the model is told so. */
export class ExtractBookingTool implements AssistantTool {
  readonly definition = {
    name: 'extract_booking',
    description:
      'Read a booking confirmation (PDF or photo) and propose its events, segments and seats. Not available yet.',
    inputSchema: {
      type: 'object',
      properties: { documentId: { type: 'string' } },
      additionalProperties: false,
    },
  }

  async run(): Promise<ToolOutcome> {
    return {
      content:
        'extract_booking is not available yet. Tell the member to add the booking by hand for now, or describe it and propose the events with propose_event_changes.',
    }
  }
}
