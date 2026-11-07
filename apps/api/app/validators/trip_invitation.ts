import vine from '@vinejs/vine'
import { INVITABLE_ROLES } from '@monkitrips/shared'
import { emailSchema } from '#validators/auth'

/** No e-mail = an invitation by link. */
export const createInvitationValidator = vine.compile(
  vine.object({
    email: emailSchema.optional(),
    role: vine.enum(INVITABLE_ROLES).optional(),
  })
)
