import vine from '@vinejs/vine'
import { TRIP_MEMBER_ROLES } from '@monkitrips/shared'

export const updateMemberValidator = vine.compile(
  vine.object({ role: vine.enum(TRIP_MEMBER_ROLES) })
)

export const transferOwnershipValidator = vine.compile(
  vine.object({ userId: vine.string().uuid() })
)
