import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Trip from '#models/trip'

/** Someone who travels; `userId` is null for a person without an account. */
export default class Traveller extends BaseModel {
  static override selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tripId: string

  @column()
  declare displayName: string

  @column()
  declare userId: string | null

  @column()
  declare position: number

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

  /** Mirrors the column defaults on the instance (Lucid reads only the id back after an insert). */
  @beforeCreate()
  static assignDefaults(traveller: Traveller) {
    traveller.id ||= randomUUID()
    traveller.userId ??= null
    traveller.position ??= 0
    traveller.fieldClock ??= {}
    traveller.deletedAt ??= null
    traveller.updatedBy ??= null
  }
}
