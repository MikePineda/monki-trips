import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { InvitableRole } from '@monkitrips/shared'
import Trip from '#models/trip'

/** An invitation row; the plaintext token exists only in the response that created it. */
export default class TripInvitation extends BaseModel {
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tripId: string

  @column()
  declare email: string | null

  @column({ serializeAs: null })
  declare tokenHash: string

  @column()
  declare role: InvitableRole

  @column()
  declare invitedBy: string | null

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime()
  declare acceptedAt: DateTime | null

  @column()
  declare acceptedBy: string | null

  @column.dateTime()
  declare revokedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Trip)
  declare trip: BelongsTo<typeof Trip>

  /** Mirrors the column defaults on the instance (Lucid reads only the id back after an insert). */
  @beforeCreate()
  static assignDefaults(invitation: TripInvitation) {
    invitation.id ||= randomUUID()
    invitation.email ??= null
    invitation.role ??= 'editor'
    invitation.invitedBy ??= null
    invitation.acceptedAt ??= null
    invitation.acceptedBy ??= null
    invitation.revokedAt ??= null
  }
}
