import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { planReminders, type PlannedReminder } from '@monkitrips/shared'
import type User from '#models/user'
import { zoneOffsetAt } from '#domain/zone_offset'
import { NotificationSettingsStore } from '#services/notification_settings_store'
import { ReminderTripsLoader } from '#services/reminder_trips_loader'

/** Trips that ended more than this many days ago plan nothing and are not loaded. */
const ENDED_GRACE_DAYS = 2

/**
 * The reminders accounts get: their settings and the live trips they are
 * live members of, through the shared planner. `GET /me/reminders/upcoming`
 * (one account) and the `push:reminders` job (every account with a device,
 * in one batch) both plan through here, so what the list shows is what the
 * job sends.
 */
@inject()
export class UserReminders {
  constructor(
    private readonly trips: ReminderTripsLoader,
    private readonly settings: NotificationSettingsStore
  ) {}

  async plan(user: User, now: Date): Promise<PlannedReminder[]> {
    const planned = await this.planFor([user.id], now)
    return planned.get(user.id) ?? []
  }

  /**
   * The plan of every account in `userIds`, with a fixed number of queries:
   * settings in one, trips through `ReminderTripsLoader`; accounts that
   * turned every reminder off load no trip.
   */
  async planFor(userIds: readonly string[], now: Date): Promise<Map<string, PlannedReminder[]>> {
    const settings = await this.settings.forUsers(userIds)
    const wanted = userIds.filter((id) => {
      const choice = settings.get(id)!
      return choice.leaveAt || choice.checkOut || choice.tasksDue
    })
    const oldestEnd = DateTime.fromJSDate(now, { zone: 'utc' })
      .minus({ days: ENDED_GRACE_DAYS })
      .toISODate()!
    const tripsByUser = await this.trips.forUsers(wanted, oldestEnd)
    const plans = new Map<string, PlannedReminder[]>(userIds.map((id) => [id, []]))
    for (const id of wanted) {
      plans.set(
        id,
        planReminders({
          now: now.toISOString(),
          settings: settings.get(id)!,
          trips: tripsByUser.get(id) ?? [],
          offsetAt: zoneOffsetAt,
        })
      )
    }
    return plans
  }
}
