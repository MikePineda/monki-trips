import vine from '@vinejs/vine'
import { SYNC_OPS, SYNC_PUSH_ENTITIES, SYNC_PUSH_MAX_MUTATIONS } from '@monkitrips/shared'
import { instantField } from '#validators/sync/fields'

/**
 * The envelope of `POST /sync/push`. Each mutation's `changes` are validated
 * per entity by the applier, so a bad field rejects that mutation alone and
 * the rest of the batch still applies. `tripId`, `id` and `mutationId` are
 * client UUIDs; tenancy is checked per mutation (never 403).
 */
export const syncPushValidator = vine.compile(
  vine.object({
    mutations: vine
      .array(
        vine.object({
          mutationId: vine.string().uuid(),
          tripId: vine.string().uuid(),
          entity: vine.enum(SYNC_PUSH_ENTITIES),
          op: vine.enum(SYNC_OPS),
          id: vine.string().uuid(),
          changes: vine.object({}).allowUnknownProperties().optional(),
          changedAt: instantField,
        })
      )
      .maxLength(SYNC_PUSH_MAX_MUTATIONS),
  })
)

/** Query of `GET /sync/pull`. */
export const syncPullValidator = vine.compile(
  vine.object({
    cursor: vine.string().trim().minLength(1).maxLength(200).optional(),
    limit: vine.number().withoutDecimals().min(1).max(500).optional(),
  })
)
