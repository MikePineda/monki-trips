import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'

/** A browser's Web Push subscription, owned by one account. */
export default class PushSubscription extends BaseModel {
  static override selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare endpoint: string

  // The naming strategy would snake-case this to p_256_dh.
  @column({ columnName: 'p256dh', serializeAs: null })
  declare p256dh: string

  @column({ serializeAs: null })
  declare auth: string

  @column()
  declare deviceLabel: string | null

  @column()
  declare failures: number

  @column.dateTime()
  declare lastUsedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /** Mirrors the column defaults on the instance (Lucid reads only the id back after an insert). */
  @beforeCreate()
  static assignDefaults(subscription: PushSubscription) {
    subscription.id ||= randomUUID()
    subscription.deviceLabel ??= null
    subscription.failures ??= 0
    subscription.lastUsedAt ??= null
  }
}
