import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { planReminders, type PlannedReminder } from '@monkitrips/shared'
import type User from '#models/user'
import { toReminderTrip } from '#domain/reminder_trip'
import { zoneOffsetAt } from '#domain/zone_offset'
import { NotificationSettingsStore } from '#services/notification_settings_store'
import { TripContent } from '#services/trip_content'
import { TripMembership } from '#services/trip_membership'

/** Trips that ended more than this many days ago plan nothing and are not loaded. */
const ENDED_GRACE_DAYS = 2

/**
 * The reminders one account gets: its settings and the live trips it is a
 * live member of, through the shared planner. `GET /me/reminders/upcoming`
 * and the `push:reminders` job both plan through here, so what the list
 * shows is what the job sends.
 */
@inject()
export class UserReminders {
  constructor(
    private readonly memberships: TripMembership,
    private readonly content: TripContent,
    private readonly settings: NotificationSettingsStore
  ) {}

  async plan(user: User, now: Date): Promise<PlannedReminder[]> {
    const settings = await this.settings.forUser(user.id)
    if (!settings.leaveAt && !settings.checkOut && !settings.tasksDue) return []
    const oldestEnd = DateTime.fromJSDate(now, { zone: 'utc' })
      .minus({ days: ENDED_GRACE_DAYS })
      .toISODate()!
    const trips = []
    for (const membership of await this.memberships.tripsOf(user)) {
      const trip = membership.trip
      const endsOn = trip.endsOn.toISODate()!
      if (endsOn < oldestEnd) continue
      const rows = await this.content.load(trip.id)
      trips.push(
        toReminderTrip(
          {
            id: trip.id,
            name: trip.name,
            startsOn: trip.startsOn.toISODate()!,
            endsOn,
            homeTz: trip.homeTz,
          },
          rows
        )
      )
    }
    return planReminders({
      now: now.toISOString(),
      settings,
      trips,
      offsetAt: zoneOffsetAt,
    })
  }
}
