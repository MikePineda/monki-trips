import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { errors as vineErrors } from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import { fileTypeFromFile } from 'file-type'
import type { ApiEnvelope, TripDocumentRow } from '@monkitrips/shared'
import { Clock } from '#services/clock'
import { ApiException } from '#exceptions/api_exception'
import {
  MAX_DOCUMENT_BYTES,
  contentDispositionFor,
  documentStorageKey,
  isAllowedDocumentMime,
} from '#domain/document_files'
import { syncPrintTask } from '#services/sync/entities/document_entity'
import { PULL_ENTITIES } from '#services/sync/entity_registry'
import type { DbRow } from '#services/sync/entity_spec'
import { rowToWire } from '#services/sync/row_wire'
import { liveRowInTrip } from '#services/sync/table_writes'
import { uploadDocumentValidator } from '#validators/document'

/** How long a download link works. */
const SIGNED_URL_TTL = '300s'

/**
 * The bytes of documents. Upload creates a `file` document (metadata edits
 * then go through sync push); download answers a redirect to a short signed
 * URL of the private store. Only the bytes decide the type: a disguised
 * executable is refused with 415 whatever its name says.
 */
@inject()
export default class DocumentsController {
  constructor(private readonly clock: Clock) {}

  async store(ctx: HttpContext): Promise<ApiEnvelope<TripDocumentRow>> {
    const file = ctx.request.file('file', { size: MAX_DOCUMENT_BYTES })
    try {
      const body = await ctx.request.validateUsing(uploadDocumentValidator)
      return await this.storeFile(ctx, body, file)
    } finally {
      // The bodyparser leaves the upload in the OS temp dir; the store has its own copy now.
      if (file?.tmpPath) await rm(file.tmpPath, { force: true })
    }
  }

  private async storeFile(
    ctx: HttpContext,
    body: Infer<typeof uploadDocumentValidator>,
    file: ReturnType<HttpContext['request']['file']>
  ): Promise<ApiEnvelope<TripDocumentRow>> {
    const user = ctx.auth.use('web').getUserOrFail()
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
    if (!file.tmpPath || file.size > MAX_DOCUMENT_BYTES) throw new ApiException('E_FILE_TOO_LARGE')
    const sniffed = await fileTypeFromFile(file.tmpPath)
    if (!isAllowedDocumentMime(sniffed?.mime)) throw new ApiException('E_UNSUPPORTED_FILE')
    const mime = sniffed.mime
    const sha256 = await hashFile(file.tmpPath)

    const id = body.id ?? randomUUID()
    const tripId = ctx.trip.id
    const now = this.clock.now()
    const existing = (await db.from('documents').where('id', id).first()) as DbRow | null
    if (existing) {
      if (existing.trip_id !== tripId || existing.deleted_at)
        throw new ApiException('E_ROW_NOT_FOUND')
      return { data: rowToWire(PULL_ENTITIES.document, existing) as unknown as TripDocumentRow }
    }
    if (body.eventId && !(await liveRowInTrip(db.connection(), 'events', body.eventId, tripId))) {
      throw new ApiException('E_ROW_NOT_FOUND')
    }

    const key = documentStorageKey(tripId, id)
    try {
      await drive.use().putStream(key, createReadStream(file.tmpPath), {
        contentType: mime,
        visibility: 'private',
      })
    } catch (error) {
      ctx.logger.error({ err: error }, 'document upload failed')
      throw new ApiException('E_STORAGE_UNAVAILABLE')
    }

    const title =
      (body.title ?? file.clientName.replace(/\.[^.]+$/, '').slice(0, 200)) || 'Document'
    const tags = body.tags ?? []
    const changedAt = now.getTime()
    const row = await db.transaction(async (trx) => {
      const trip = (await trx.from('trips').where('id', tripId).first()) as DbRow
      await trx.table('documents').insert({
        id,
        trip_id: tripId,
        event_id: body.eventId ?? null,
        kind: 'file',
        title,
        storage_key: key,
        mime,
        size_bytes: file.size,
        sha256,
        tags,
        available_offline: body.availableOffline ?? false,
        uploaded_by: user.id,
        updated_by: user.id,
        field_clock: JSON.stringify({
          title: changedAt,
          tags: changedAt,
          eventId: changedAt,
          availableOffline: changedAt,
        }),
      })
      const fresh = (await trx.from('documents').where('id', id).first()) as DbRow
      await syncPrintTask(trx, fresh, trip, { userId: user.id, now: now.toISOString(), changedAt })
      await trx.table('trip_activity').insert({
        trip_id: tripId,
        actor_user_id: user.id,
        entity: 'document',
        entity_id: id,
        action: 'created',
        fields: ['title', 'tags', 'eventId', 'availableOffline', 'file'],
      })
      return fresh
    })
    ctx.response.status(201)
    return { data: rowToWire(PULL_ENTITIES.document, row) as unknown as TripDocumentRow }
  }

  /** 302 to a signed URL that works for five minutes; images and PDFs open inline, the rest download. */
  async file(ctx: HttpContext) {
    const { id } = ctx.params as { id: string }
    const document = (await db
      .from('documents')
      .where('id', id)
      .where('trip_id', ctx.trip.id)
      .whereNull('deleted_at')
      .first()) as DbRow | null
    if (!document || document.kind !== 'file' || !document.storage_key) {
      throw new ApiException('E_ROW_NOT_FOUND')
    }
    const mime = (document.mime as string | null) ?? null
    const extension = mime ? mimeExtension(mime) : ''
    const url = await drive.use().getSignedUrl(String(document.storage_key), {
      expiresIn: SIGNED_URL_TTL,
      contentType: mime ?? undefined,
      contentDisposition: contentDispositionFor(mime, `${document.title}${extension}`),
    })
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.redirect(url, false, 302)
  }
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

function mimeExtension(mime: string): string {
  const known: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
  }
  return known[mime] ?? ''
}
