import { readFile, rm } from 'node:fs/promises'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import { fileTypeFromBuffer } from 'file-type'
import {
  EXTRACTION_IMAGE_MIMES,
  EXTRACTION_MAX_IMAGE_BYTES,
  type AiAction,
  type ApiEnvelope,
  type ReceiptDraft,
} from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import { BookingExtraction } from '#services/assistant/extraction/booking_extraction'
import { ReceiptExtraction } from '#services/assistant/extraction/receipt_extraction'

/**
 * Reading a booking or a receipt with the model. Both routes are throttled
 * (`throttleLlm`) and metered; a document of another trip, like a trip the
 * caller is not a member of, answers 404.
 */
@inject()
export default class ExtractionsController {
  constructor(
    private readonly bookings: BookingExtraction,
    private readonly receipts: ReceiptExtraction
  ) {}

  /** 201 with the `extract_booking` proposal; nothing is written until it is accepted. */
  async document(ctx: HttpContext): Promise<ApiEnvelope<AiAction>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const action = await this.bookings.fromDocument(
      user,
      ctx.trip,
      String(ctx.params['id']),
      ctx.i18n
    )
    ctx.response.status(201)
    return { data: action }
  }

  /**
   * 200 with what the receipt photo says, for the quick expense sheet. The
   * photo (JPEG, PNG, WebP or GIF by its bytes, at most 5 MB) is never
   * stored: the bodyparser's temp copy is removed before answering.
   */
  async receipt(ctx: HttpContext): Promise<ApiEnvelope<ReceiptDraft>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const file = ctx.request.file('file', { size: EXTRACTION_MAX_IMAGE_BYTES })
    try {
      if (!file) {
        throw new vineErrors.E_VALIDATION_ERROR([
          {
            field: 'file',
            rule: 'required',
            message: ctx.i18n.t('validator.shared.messages.required', {
              field: ctx.i18n.t('validator.shared.fields.file', {}, 'file'),
            }),
          },
        ])
      }
      if (!file.isValid) {
        const tooLarge = file.errors.some((error) => error.type === 'size')
        throw new ApiException(tooLarge ? 'E_FILE_TOO_LARGE' : 'E_BAD_REQUEST')
      }
      if (!file.tmpPath || file.size > EXTRACTION_MAX_IMAGE_BYTES) {
        throw new ApiException('E_FILE_TOO_LARGE')
      }
      const bytes = await readFile(file.tmpPath)
      const sniffed = await fileTypeFromBuffer(bytes)
      if (!sniffed || !(EXTRACTION_IMAGE_MIMES as readonly string[]).includes(sniffed.mime)) {
        throw new ApiException('E_UNSUPPORTED_FILE')
      }
      return { data: await this.receipts.fromImage(user, ctx.trip, bytes, sniffed.mime) }
    } finally {
      if (file?.tmpPath) await rm(file.tmpPath, { force: true })
    }
  }
}
