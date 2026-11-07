import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { TripMemberRole } from '@monkitrips/shared'
import Trip from '#models/trip'
import User from '#models/user'

/** Membership of an account in a trip. Soft-deleted when removed (sync tombstone). */
export default class TripMember extends BaseModel {
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tripId: string

  @column()
  declare userId: string

  @column()
  declare role: TripMemberRole

  @column.dateTime({ autoCreate: true })
  declare joinedAt: DateTime

  @column()
  declare fieldClock: Record<string, number>

  @column.dateTime()
  declare deletedAt: DateTime | null

  @column()
  declare updatedBy: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Trip)
  declare trip: BelongsTo<typeof Trip>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /** Mirrors the column defaults on the instance (Lucid reads only the id back after an insert). */
  @beforeCreate()
  static assignDefaults(member: TripMember) {
    member.id ||= randomUUID()
    member.fieldClock ??= {}
    member.deletedAt ??= null
    member.updatedBy ??= null
  }
}
