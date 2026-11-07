import vine from '@vinejs/vine'
import { LOCALES } from '@monkitrips/shared'

/** Passwords: long enough to resist guessing, no composition rules. */
export const passwordSchema = vine.string().minLength(10).maxLength(200)

export const emailSchema = vine.string().trim().toLowerCase().email().maxLength(254)

export const displayNameSchema = vine.string().trim().minLength(1).maxLength(80)

export const timezoneSchema = vine.string().trim().in(Intl.supportedValuesOf('timeZone'))

export const signupValidator = vine.compile(
  vine.object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema,
    locale: vine.enum(LOCALES).optional(),
    timezone: timezoneSchema.optional(),
    invitationToken: vine.string().trim().minLength(20).maxLength(200).optional(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: emailSchema,
    password: vine.string().minLength(1).maxLength(200),
  })
)

export const verifyEmailValidator = vine.compile(
  vine.object({ token: vine.string().trim().minLength(20).maxLength(200) })
)

export const verifyCodeValidator = vine.compile(
  vine.object({
    code: vine
      .string()
      .trim()
      .regex(/^\d{6}$/),
  })
)

export const forgotPasswordValidator = vine.compile(vine.object({ email: emailSchema }))

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(20).maxLength(200),
    password: passwordSchema,
  })
)
