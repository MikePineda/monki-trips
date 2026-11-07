import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { BudgetMode } from '@monkitrips/shared'
import TripMember from '#models/trip_member'
import Traveller from '#models/traveller'
import TripInvitation from '#models/trip_invitation'

/** Postgres returns bigint as a string; minor units fit a JS number for any real budget. */
const bigintToNumber = (value: string | number | null) => (value === null ? null : Number(value))

/**
 * The tenant. Syncable: the trigger stamps `changeXid`/`changeSeq`, so the
 * model never writes them; `deletedAt` is the restorable soft delete.
 */
export default class Trip extends BaseModel {
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare baseCurrency: string

  @column()
  declare budgetMode: BudgetMode

  @column({ consume: bigintToNumber })
  declare budgetTotalMinor: number | null

  @column.date()
  declare startsOn: DateTime

  @column.date()
  declare endsOn: DateTime

  @column()
  declare homeTz: string

  @column()
  declare createdBy: string | null

  @column.dateTime()
  declare purgeAfter: DateTime | null

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

  @hasMany(() => TripMember)
  declare members: HasMany<typeof TripMember>

  @hasMany(() => Traveller)
  declare travellers: HasMany<typeof Traveller>

  @hasMany(() => TripInvitation)
  declare invitations: HasMany<typeof TripInvitation>

  /** Mirrors the column defaults on the instance (Lucid reads only the id back after an insert). */
  @beforeCreate()
  static assignDefaults(trip: Trip) {
    trip.id ||= randomUUID()
    trip.budgetMode ??= 'shared'
    trip.budgetTotalMinor ??= null
    trip.homeTz ??= 'UTC'
    trip.createdBy ??= null
    trip.purgeAfter ??= null
    trip.fieldClock ??= {}
    trip.deletedAt ??= null
    trip.updatedBy ??= null
  }
}
