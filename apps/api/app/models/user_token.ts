import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { UserTokenPurpose } from '@monkitrips/shared'
import User from '#models/user'

/** A single-use token row: hashes only, see `#domain/secure_token`. */
export default class UserToken extends BaseModel {
  static override selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare purpose: UserTokenPurpose

  @column()
  declare tokenHash: string

  @column()
  declare codeHash: string | null

  @column()
  declare attempts: number

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime()
  declare usedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /** Mirrors the column defaults on the instance (Lucid reads only the id back after an insert). */
  @beforeCreate()
  static assignDefaults(token: UserToken) {
    token.id ||= randomUUID()
    token.codeHash ??= null
    token.attempts ??= 0
    token.usedAt ??= null
  }
}
