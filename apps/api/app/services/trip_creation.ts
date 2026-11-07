import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DEFAULT_BUDGET_CATEGORY_KEYS, type BudgetMode } from '@monkitrips/shared'
import Trip from '#models/trip'
import TripMember from '#models/trip_member'
import Traveller from '#models/traveller'
import type User from '#models/user'
import { Clock } from '#services/clock'

export interface NewTrip {
  id?: string
  name: string
  baseCurrency: string
  startsOn: string
  endsOn: string
  homeTz?: string
  budgetMode?: BudgetMode
  budgetTotalMinor?: number | null
}

/**
 * Creates a trip with its owner membership, the owner's traveller row and
 * the default budget categories in one transaction. The owner is the only
 * member a trip starts with.
 */
@inject()
export class TripCreation {
  constructor(private readonly clock: Clock) {}

  async create(owner: User, input: NewTrip): Promise<Trip> {
    const { trip } = await this.createOrFind(owner, input)
    return trip
  }

  /**
   * Like `create`, but a client `id` that already names a trip returns that
   * trip untouched (`created: false`); the caller decides who may see it.
   * The lookup runs inside the transaction, right before the insert.
   */
  async createOrFind(owner: User, input: NewTrip): Promise<{ trip: Trip; created: boolean }> {
    const now = DateTime.fromJSDate(this.clock.now())
    return db.transaction(async (trx) => {
      const existing = input.id ? await Trip.find(input.id, { client: trx }) : null
      if (existing) return { trip: existing, created: false }
      const trip = await Trip.create(
        {
          id: input.id,
          name: input.name,
          baseCurrency: input.baseCurrency.toUpperCase(),
          budgetMode: input.budgetMode ?? 'shared',
          budgetTotalMinor: input.budgetTotalMinor ?? null,
          startsOn: DateTime.fromISO(input.startsOn),
          endsOn: DateTime.fromISO(input.endsOn),
          homeTz: input.homeTz ?? owner.timezone,
          createdBy: owner.id,
          updatedBy: owner.id,
        },
        { client: trx }
      )
      await TripMember.create(
        { tripId: trip.id, userId: owner.id, role: 'owner', joinedAt: now, updatedBy: owner.id },
        { client: trx }
      )
      await Traveller.create(
        {
          tripId: trip.id,
          userId: owner.id,
          displayName: owner.displayName,
          position: 0,
          updatedBy: owner.id,
        },
        { client: trx }
      )
      await trx.table('budget_categories').insert(
        DEFAULT_BUDGET_CATEGORY_KEYS.map((key, position) => ({
          trip_id: trip.id,
          key,
          position,
          updated_by: owner.id,
        }))
      )
      return { trip, created: true }
    })
  }
}
