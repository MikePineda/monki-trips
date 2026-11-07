import vine from '@vinejs/vine'
import { LOCALES, THEMES } from '@monkitrips/shared'
import { displayNameSchema, passwordSchema, timezoneSchema } from '#validators/auth'

export const updateProfileValidator = vine.compile(
  vine.object({
    displayName: displayNameSchema.optional(),
    locale: vine.enum(LOCALES).optional(),
    timezone: timezoneSchema.optional(),
    theme: vine.enum(THEMES).optional(),
  })
)

export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string().minLength(1).maxLength(200),
    password: passwordSchema,
  })
)

/** Destructive account actions re-ask the password. */
export const deleteAccountValidator = vine.compile(
  vine.object({ password: vine.string().minLength(1).maxLength(200) })
)
