import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import type { ErrorCode } from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type { AssistantTool, ToolContext, ToolOutcome } from '#services/assistant/assistant_tool'
import { ToolInputError, toolData } from '#services/assistant/assistant_tool'
import { BookingExtraction } from '#services/assistant/extraction/booking_extraction'
import { ProposalRecorder } from '#services/assistant/proposal_recorder'
import { validateToolInput } from '#services/assistant/tool_input'

const input = vine.compile(vine.object({ documentId: vine.string().uuid() }))

/** What the model reads when the document cannot be read; app-written, never file content. */
const REFUSALS: Partial<Record<ErrorCode, string>> = {
  E_ROW_NOT_FOUND: 'documentId must be the id of a document of this trip (see list_documents).',
  E_UNSUPPORTED_FILE:
    'This document cannot be read: only uploaded PDFs and JPEG, PNG, WebP or GIF images can.',
  E_FILE_TOO_LARGE: 'This document is too large to read (more than 10 scanned pages or 5 MB).',
  E_EXTRACTION_UNAVAILABLE:
    'This server cannot read scans or photos. Tell the member to add the booking by hand, or propose it from what they describe.',
  E_LLM_BAD_OUTPUT: 'The booking could not be read reliably. Tell the member to add it by hand.',
  E_STORAGE_UNAVAILABLE: 'The file store is not reachable right now. Try again later.',
}

/**
 * Reads a booking document of the trip (by id, from `list_documents`) and
 * records its event as a proposal, through the same `BookingExtraction`
 * the document's "Read this booking" uses: a separate, metered model call
 * (purpose `extract_booking`) whose answer is validated and dry-run before
 * the member sees it. The proposal belongs to this chat turn; the member
 * accepts or rejects it. The cap (402) and outages (503) end the turn like
 * any other model failure.
 */
@inject()
export class ExtractBookingTool implements AssistantTool {
  readonly definition = {
    name: 'extract_booking',
    description:
      'Read a booking confirmation the member uploaded to this trip (PDF or photo) and propose its event, legs and seats for the member to accept. Nothing changes until the member accepts. Take documentId from list_documents.',
    inputSchema: {
      type: 'object',
      properties: { documentId: { type: 'string', description: 'Id of a document of this trip' } },
      required: ['documentId'],
      additionalProperties: false,
    },
  }

  constructor(private readonly extraction: BookingExtraction) {}

  async run(ctx: ToolContext, raw: Record<string, unknown>): Promise<ToolOutcome> {
    const { documentId } = await validateToolInput<{ documentId: string }>(input, raw)
    try {
      const action = await this.extraction.fromDocument(ctx.user, ctx.trip, documentId, ctx.i18n, {
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
      })
      return { ...toolData(this.definition.name, ProposalRecorder.forModel(action)), action }
    } catch (error) {
      const refusal =
        error instanceof ApiException && error.code ? REFUSALS[error.code as ErrorCode] : undefined
      if (refusal) throw new ToolInputError(refusal)
      throw error
    }
  }
}
