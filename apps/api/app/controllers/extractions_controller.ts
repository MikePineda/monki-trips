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
   * stored, not even in the temp dir: the bodyparser leaves this route
   * alone (`processManually`), so nothing is read before CSRF, auth, the
   * throttle and the trip check pass, and then the part is read into
   * memory only.
   */
  async receipt(ctx: HttpContext): Promise<ApiEnvelope<ReceiptDraft>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const photo = await readPhoto(ctx)
    if (photo === 'missing') {
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
    if (photo === 'too_large') throw new ApiException('E_FILE_TOO_LARGE')
    const sniffed = await fileTypeFromBuffer(photo)
    if (!sniffed || !(EXTRACTION_IMAGE_MIMES as readonly string[]).includes(sniffed.mime)) {
      throw new ApiException('E_UNSUPPORTED_FILE')
    }
    return { data: await this.receipts.fromImage(user, ctx.trip, photo, sniffed.mime) }
  }
}

/** Slack over the photo for the other parts of the form (boundaries, a field or two). */
const FORM_OVERHEAD_BYTES = 64 * 1024

/**
 * The `file` part of the request, read into memory and never written to
 * disk; past `EXTRACTION_MAX_IMAGE_BYTES` the rest is drained and dropped.
 */
async function readPhoto(ctx: HttpContext): Promise<Buffer | 'missing' | 'too_large'> {
  if (!ctx.request.is(['multipart/form-data'])) return 'missing'
  let photo: Buffer | null = null
  let tooLarge = false
  ctx.request.multipart.onFile('file', {}, async (part) => {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of part as AsyncIterable<Buffer>) {
      size += chunk.length
      if (size > EXTRACTION_MAX_IMAGE_BYTES) tooLarge = true
      else chunks.push(chunk)
    }
    if (!tooLarge) photo = Buffer.concat(chunks)
  })
  try {
    await ctx.request.multipart.process({
      limit: EXTRACTION_MAX_IMAGE_BYTES + FORM_OVERHEAD_BYTES,
    })
  } catch (error) {
    if ((error as { status?: number }).status === 413) return 'too_large'
    throw new ApiException('E_BAD_REQUEST')
  }
  if (tooLarge) return 'too_large'
  return photo ?? 'missing'
}
