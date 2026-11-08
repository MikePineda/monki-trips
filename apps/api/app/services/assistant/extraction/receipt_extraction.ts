import { inject } from '@adonisjs/core'
import {
  majorAmountToMinor,
  minorUnitExponent,
  type ExtractionReviewFlag,
  type ReceiptDraft,
} from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type Trip from '#models/trip'
import type User from '#models/user'
import { LlmProvider } from '#services/llm/llm_provider'
import { StructuredCompletion } from '#services/llm/structured_completion'
import type { ModelFlags } from '#services/assistant/extraction/booking_draft_rules'
import { extractionInputOf } from '#services/assistant/extraction/extraction_input'
import { receiptPrompt } from '#services/assistant/extraction/extraction_prompts'
import { receiptOutputValidator } from '#validators/booking_extraction'
import { RECEIPT_MAX_OUTPUT_TOKENS } from '#config/extraction'

interface ReceiptOutput extends ModelFlags {
  amount?: string | null
  currency?: string | null
  spentOn?: string | null
  merchant?: string | null
  categoryKey?: ReceiptDraft['categoryKey']
}

const FIELDS = ['amount', 'currency', 'spentOn', 'merchant', 'categoryKey'] as const

/** Problems the model is asked to fix once: a currency that is not ISO 4217, an amount it cannot hold. */
function receiptProblems(output: ReceiptOutput): string[] {
  const problems: string[] = []
  const currency = output.currency?.toUpperCase() ?? null
  if (currency && !minorUnitExponent(currency).known)
    problems.push('currency: not an ISO 4217 code')
  else if (output.amount && currency && majorAmountToMinor(output.amount, currency) === null) {
    problems.push('amount: more decimals than the currency has')
  }
  return problems
}

/**
 * Reads a receipt photo for the quick expense sheet: the image goes to the
 * vision model (no vision configured: 503 `E_EXTRACTION_UNAVAILABLE`)
 * through `StructuredCompletion` (purpose `extract_booking`, capped and
 * metered) and comes back as a `ReceiptDraft` the member confirms and
 * saves as a normal expense. Nothing is stored here: not the photo, not an
 * `ai_actions` row, not the answer.
 */
@inject()
export class ReceiptExtraction {
  constructor(
    private readonly structured: StructuredCompletion,
    private readonly provider: LlmProvider
  ) {}

  async fromImage(user: User, trip: Trip, bytes: Buffer, mime: string): Promise<ReceiptDraft> {
    if (mime === 'application/pdf') throw new ApiException('E_UNSUPPORTED_FILE')
    const input = await extractionInputOf(bytes, mime, { vision: this.provider.supportsVision })
    if (input.source !== 'vision') throw new ApiException('E_UNSUPPORTED_FILE')

    const { value } = await this.structured.run<ReceiptOutput>({
      caller: { user, tripId: trip.id },
      purpose: 'extract_booking',
      prompt: receiptPrompt(input.block),
      schema: receiptOutputValidator,
      check: receiptProblems,
      maxTokens: RECEIPT_MAX_OUTPUT_TOKENS,
    })
    const draft: Omit<ReceiptDraft, 'review'> = {
      amount: value.amount?.trim() || null,
      currency: value.currency?.trim().toUpperCase() || null,
      spentOn: value.spentOn ?? null,
      merchant: value.merchant?.trim() || null,
      categoryKey: value.categoryKey ?? null,
    }
    const review: ExtractionReviewFlag[] = []
    for (const field of ['amount', 'currency', 'spentOn'] as const) {
      if (draft[field] === null) review.push({ field, reason: 'missing' })
    }
    const add = (field: string, reason: ExtractionReviewFlag['reason']) => {
      if ((FIELDS as readonly string[]).includes(field) && !review.some((f) => f.field === field)) {
        review.push({ field, reason })
      }
    }
    for (const field of value.needsReview ?? []) add(field, 'needs_review')
    for (const field of value.lowConfidence ?? []) add(field, 'low_confidence')
    return { ...draft, review }
  }
}
