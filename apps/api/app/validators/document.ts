import vine from '@vinejs/vine'
import { DOCUMENT_TAGS } from '@monkitrips/shared'

/**
 * Fields of `POST /trips/:tripId/documents` besides the file. `id` is the
 * client's UUID (idempotent re-upload); `eventId` must be a live event of
 * the trip; `tags` are the three the app understands.
 */
export const uploadDocumentValidator = vine.compile(
  vine.object({
    id: vine.string().uuid().optional(),
    title: vine.string().trim().minLength(1).maxLength(200).optional(),
    eventId: vine.string().uuid().nullable().optional(),
    tags: vine.array(vine.enum(DOCUMENT_TAGS)).distinct().optional(),
    availableOffline: vine.boolean().optional(),
  })
)
