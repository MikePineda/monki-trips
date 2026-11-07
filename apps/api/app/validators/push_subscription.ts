import vine from '@vinejs/vine'

/** `PushSubscription.toJSON()` from the browser plus an optional device label. */
export const registerPushSubscriptionValidator = vine.compile(
  vine.object({
    endpoint: vine
      .string()
      .trim()
      .url({ protocols: ['https'] })
      .maxLength(2048),
    keys: vine.object({
      p256dh: vine.string().trim().minLength(1).maxLength(512),
      auth: vine.string().trim().minLength(1).maxLength(512),
    }),
    deviceLabel: vine.string().trim().maxLength(80).optional(),
  })
)
