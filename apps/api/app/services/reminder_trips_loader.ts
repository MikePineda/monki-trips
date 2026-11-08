import db from '@adonisjs/lucid/services/db'
import type { ReminderTrip, TripEventRow, TripStopRow, TripTaskRow } from '@monkitrips/shared'
import { toReminderTrip } from '#domain/reminder_trip'
import { PULL_ENTITIES } from '#services/sync/entity_registry'
import type { DbRow, EntitySpec } from '#services/sync/entity_spec'
import { rowToWire } from '#services/sync/row_wire'

interface MembershipRow {
  user_id: string
  id: string
  name: string
  starts_on: string
  ends_on: string
  home_tz: string
}

/**
 * The live trips of many accounts as the reminder planner reads them, in a
 * fixed number of queries whatever the number of accounts or trips: one for
 * the live memberships of live trips not ended before `oldestEnd`, then one
 * per table the planner needs (stops, events, tasks) for all those trips.
 * Each trip is built once and shared by every member. Nothing else of a
 * trip (expenses, seats, documents, phrase cards) is read.
 */
export class ReminderTripsLoader {
  async forUsers(
    userIds: readonly string[],
    oldestEnd: string
  ): Promise<Map<string, ReminderTrip[]>> {
    const byUser = new Map<string, ReminderTrip[]>(userIds.map((id) => [id, []]))
    if (userIds.length === 0) return byUser
    const memberships = (await db
      .from('trip_members')
      .join('trips', 'trips.id', 'trip_members.trip_id')
      .whereIn('trip_members.user_id', [...userIds])
      .whereNull('trip_members.deleted_at')
      .whereNull('trips.deleted_at')
      .where('trips.ends_on', '>=', oldestEnd)
      .select(
        'trip_members.user_id',
        'trips.id',
        'trips.name',
        'trips.home_tz',
        db.raw(`to_char(trips.starts_on, 'YYYY-MM-DD') as starts_on`),
        db.raw(`to_char(trips.ends_on, 'YYYY-MM-DD') as ends_on`)
      )
      .orderBy('trips.id', 'asc')) as MembershipRow[]
    if (memberships.length === 0) return byUser

    const tripIds = [...new Set(memberships.map((row) => row.id))]
    // One query at a time: inside a transaction the connection is shared.
    const stops = await this.rows<TripStopRow>(PULL_ENTITIES.stop, tripIds, [
      'position',
      'arrive_on',
    ])
    const events = await this.rows<TripEventRow>(PULL_ENTITIES.event, tripIds, [
      'starts_at',
      'created_at',
    ])
    const tasks = await this.rows<TripTaskRow>(PULL_ENTITIES.task, tripIds, [
      'due_on',
      'created_at',
    ])

    const trips = new Map<string, ReminderTrip>()
    for (const row of memberships) {
      let trip = trips.get(row.id)
      if (!trip) {
        trip = toReminderTrip(
          {
            id: row.id,
            name: row.name,
            startsOn: row.starts_on,
            endsOn: row.ends_on,
            homeTz: row.home_tz,
          },
          {
            stops: stops.get(row.id) ?? [],
            events: events.get(row.id) ?? [],
            tasks: tasks.get(row.id) ?? [],
          }
        )
        trips.set(row.id, trip)
      }
      byUser.get(row.user_id)?.push(trip)
    }
    return byUser
  }

  /** Live rows of `spec` for every trip in `tripIds`, in wire shape, grouped by trip id. */
  private async rows<T>(
    spec: EntitySpec,
    tripIds: readonly string[],
    order: string[]
  ): Promise<Map<string, T[]>> {
    let query = db
      .from(spec.table)
      .whereIn(spec.tripColumn, [...tripIds])
      .whereNull('deleted_at')
    for (const column of order) query = query.orderBy(column, 'asc')
    const grouped = new Map<string, T[]>()
    for (const row of (await query) as DbRow[]) {
      const tripId = String(row[spec.tripColumn])
      const list = grouped.get(tripId) ?? []
      list.push(rowToWire(spec, row) as T)
      grouped.set(tripId, list)
    }
    return grouped
  }
}
