import { inject } from '@adonisjs/core'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { toolData } from '#services/assistant/assistant_tool'
import { TripContent } from '#services/trip_content'
import { ASSISTANT_MAX_LIST_ROWS } from '#config/assistant'

/** The trip's documents by title and tags; never their contents, links or storage keys. */
@inject()
export class ListDocumentsTool implements AssistantTool {
  readonly definition = {
    name: 'list_documents',
    description:
      'Documents of the trip (vouchers, tickets, passports...): title, kind (file or link), tags (print, show_on_phone, requires_passport), the event it belongs to and whether it is available offline. Contents are not included.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  }

  constructor(private readonly content: TripContent) {}

  async run({ trip }: ToolContext): Promise<ToolOutcome> {
    const { documents } = await this.content.load(trip.id)
    return toolData(this.definition.name, {
      documents: documents.slice(0, ASSISTANT_MAX_LIST_ROWS).map((document) => ({
        id: document.id,
        title: document.title,
        kind: document.kind,
        tags: document.tags,
        eventId: document.eventId,
        availableOffline: document.availableOffline,
      })),
      truncated: documents.length > ASSISTANT_MAX_LIST_ROWS,
    })
  }
}
