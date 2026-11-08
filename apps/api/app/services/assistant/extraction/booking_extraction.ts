import { inject } from '@adonisjs/core'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import type { I18n } from '@adonisjs/i18n'
import { EXTRACTION_MAX_IMAGE_BYTES, type AiAction } from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type Trip from '#models/trip'
import type User from '#models/user'
import { ToolInputError } from '#services/assistant/assistant_tool'
import { LlmProvider } from '#services/llm/llm_provider'
import { StructuredCompletion } from '#services/llm/structured_completion'
import {
  draftProblems,
  draftReviewFlags,
  normalizeDraft,
  type LooseDraft,
  type ModelFlags,
} from '#services/assistant/extraction/booking_draft_rules'
import { BookingProposals } from '#services/assistant/extraction/booking_proposals'
import { extractionInputOf } from '#services/assistant/extraction/extraction_input'
import { bookingPrompt } from '#services/assistant/extraction/extraction_prompts'
import { bookingOutputValidator } from '#validators/booking_extraction'
import { EXTRACTION_MAX_OUTPUT_TOKENS, EXTRACTION_MAX_PDF_BYTES } from '#config/extraction'

type BookingOutput = LooseDraft & ModelFlags

/** The chat turn a proposal belongs to, when the chat asked. */
export interface ExtractionTurn {
  conversationId: string
  messageId: string
}

/**
 * Reads a booking document of the trip and proposes its event. The
 * document must be a live file of the route's trip (else 404). Its text,
 * or, for a scan or a photo, the file itself through the vision model,
 * goes through `StructuredCompletion` (purpose `extract_booking`: capped,
 * metered, one retry on a bad answer); the answer is validated, normalised,
 * flagged for review and recorded as a proposal through `BookingProposals`.
 * Nothing of the file or the answer is logged.
 */
@inject()
export class BookingExtraction {
  constructor(
    private readonly structured: StructuredCompletion,
    private readonly provider: LlmProvider,
    private readonly proposals: BookingProposals
  ) {}

  async fromDocument(
    user: User,
    trip: Trip,
    documentId: string,
    i18n: I18n,
    turn: ExtractionTurn | null = null
  ): Promise<AiAction> {
    const document = (await db
      .from('documents')
      .where('id', documentId)
      .where('trip_id', trip.id)
      .whereNull('deleted_at')
      .select('id', 'kind', 'mime', 'storage_key', 'size_bytes', 'event_id')
      .first()) as {
      id: string
      kind: string
      mime: string | null
      storage_key: string | null
      size_bytes: number | string | null
      event_id: string | null
    } | null
    if (!document) throw new ApiException('E_ROW_NOT_FOUND')
    if (document.kind !== 'file' || !document.storage_key || !document.mime) {
      throw new ApiException('E_UNSUPPORTED_FILE')
    }
    // Already attached to an event: reading it again would add a second event and move the link.
    if (document.event_id) throw new ApiException('E_DOCUMENT_ALREADY_LINKED')
    // Refused from the stored size, before the bytes are fetched or parsed.
    const limit =
      document.mime === 'application/pdf' ? EXTRACTION_MAX_PDF_BYTES : EXTRACTION_MAX_IMAGE_BYTES
    if (Number(document.size_bytes ?? 0) > limit) throw new ApiException('E_FILE_TOO_LARGE')

    let bytes: Buffer
    try {
      bytes = Buffer.from(await drive.use().getBytes(document.storage_key))
    } catch {
      throw new ApiException('E_STORAGE_UNAVAILABLE')
    }
    const input = await extractionInputOf(bytes, document.mime, {
      vision: this.provider.supportsVision,
    })

    const { value } = await this.structured.run<BookingOutput>({
      caller: { user, tripId: trip.id },
      purpose: 'extract_booking',
      prompt: bookingPrompt(input),
      schema: bookingOutputValidator,
      check: (output) =>
        draftProblems(normalizeDraft(output)).map(
          (problem) => `${problem.field}: ${problem.rule}; use null when the file does not say`
        ),
      maxTokens: EXTRACTION_MAX_OUTPUT_TOKENS,
    })
    const draft = normalizeDraft(value)
    try {
      return await this.proposals.propose(
        {
          user,
          trip,
          conversationId: turn?.conversationId ?? null,
          messageId: turn?.messageId ?? null,
        },
        i18n,
        {
          draft,
          review: draftReviewFlags(draft, value),
          source: input.source,
          documentId: document.id,
        }
      )
    } catch (error) {
      // The trip refused what the model read (a rule only the sync entity knows): nothing is proposed.
      if (error instanceof ToolInputError) throw new ApiException('E_LLM_BAD_OUTPUT')
      throw error
    }
  }
}
