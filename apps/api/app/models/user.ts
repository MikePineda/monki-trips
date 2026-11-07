import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, beforeCreate, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { Locale, Theme, UserPlan, UserStatus } from '@monkitrips/shared'
import TripMember from '#models/trip_member'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

/**
 * An account. The mixin hashes `password` before save and provides
 * `verifyCredentials(email, password)`. `sessionVersion` is compared with
 * the value stored in the session on every request: bumping it signs the
 * person out everywhere.
 */
export default class User extends compose(BaseModel, AuthFinder) {
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare displayName: string

  @column()
  declare locale: Locale

  @column()
  declare timezone: string

  @column()
  declare theme: Theme

  @column.dateTime()
  declare emailVerifiedAt: DateTime | null

  @column({ serializeAs: null })
  declare sessionVersion: number

  @column()
  declare status: UserStatus

  @column()
  declare plan: UserPlan

  @column.dateTime()
  declare deletionScheduledAt: DateTime | null

  @column.dateTime()
  declare lastLoginAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => TripMember)
  declare memberships: HasMany<typeof TripMember>

  /**
   * Mirrors the column defaults on the instance: Lucid only reads the id back
   * after an insert, and callers (login, serializers) need the real values.
   */
  @beforeCreate()
  static assignDefaults(user: User) {
    user.id ||= randomUUID()
    user.locale ??= 'en'
    user.timezone ??= 'UTC'
    user.theme ??= 'system'
    user.sessionVersion ??= 1
    user.status ??= 'active'
    user.plan ??= 'free'
    user.emailVerifiedAt ??= null
    user.deletionScheduledAt ??= null
    user.lastLoginAt ??= null
  }

  /** Signs the person out of every session, including the current one unless the caller re-stamps it. */
  async revokeAllSessions(): Promise<void> {
    this.sessionVersion += 1
    await this.save()
  }
}
