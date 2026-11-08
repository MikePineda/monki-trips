/**
 * Which push reminders a trip member gets in the next hours, computed from
 * the trips' content, the member's settings and `now`. The same input
 * always yields the same `(kind, refId, nominalFireAt)` keys, so the
 * scheduler can plan every minute and record what it sent under that key.
 * `nominalFireAt` is the fire time before quiet hours: toggling them moves
 * `fireAt` but never the key, while an edited event time is a new key.
 *
 * - `leave_at`: flights, trains, ferries and buses, at the leave time
 *   (`leave_at.ts`) read in the departure zone.
 * - `check_out`: lodging, an hour before the check-out; a check-out before
 *   10:00 local is announced at 08:00 local instead, unless that is not
 *   before the check-out.
 * - `tasks_due`: one digest per trip and trip-local day at 09:00, listing
 *   the open tasks due that day and the high-priority ones already late.
 *
 * Quiet hours move a reminder that would fire inside them to their end,
 * read in the reminder's own zone; a move that would land at or after the
 * moment the reminder is about keeps the original time instead.
 *
 * Zones: like everywhere in the domain, nothing is resolved here. Events
 * carry their offsets; for stops and the home zone the caller passes
 * `offsetAt(tz, at)` (Luxon on the server, `Intl` on the device), because a
 * digest planned tonight for tomorrow morning may sit across a DST change.
 */
import { addDays, type IsoDate } from './iso_date.ts'
import { leaveAtMs } from './leave_at.ts'
import { taskUrgency } from './task_urgency.ts'
import { tripLocalZone } from './today_view.ts'
import type { TripDates } from './trip_dates.ts'
import { isActiveEvent, type EventKind, type TripEvent } from './trip_event.ts'
import type { TripStop } from './trip_stop.ts'
import type { TripTask } from './trip_task.ts'
import {
  epochMs,
  instantOfLocalMs,
  localDate,
  localDateTime,
  localMinutesOfDay,
  type IsoInstant,
  type ZonedInstant,
} from './zoned_instant.ts'

export const REMINDER_KINDS = ['leave_at', 'check_out', 'tasks_due'] as const

export type ReminderKind = (typeof REMINDER_KINDS)[number]

/** A member's reminder choices. Quiet hours are local `HH:MM`, both set or both null. */
export interface ReminderSettings {
  leaveAt: boolean
  checkOut: boolean
  tasksDue: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
}

/** What a member without saved settings gets: every reminder, no quiet hours. */
export const DEFAULT_REMINDER_SETTINGS: Readonly<ReminderSettings> = {
  leaveAt: true,
  checkOut: true,
  tasksDue: true,
  quietHoursStart: null,
  quietHoursEnd: null,
}

/** One trip as the planner reads it; stops need no `offsetMin` (see `offsetAt`). */
export interface ReminderTrip extends TripDates {
  id: string
  name: string
  homeTz: string
  stops: readonly TripStop[]
  events: readonly TripEvent[]
  tasks: readonly TripTask[]
}

/** The UTC offset of an IANA zone at an instant, minutes east of UTC; resolved by the caller. */
export type ZoneOffsetResolver = (tz: string, at: IsoInstant) => number

export interface ReminderPlanInput {
  now: IsoInstant
  settings: ReminderSettings
  trips: readonly ReminderTrip[]
  offsetAt: ZoneOffsetResolver
  /** How far ahead to plan; 36 hours when absent. */
  horizonHours?: number
}

export type ReminderParams = Readonly<Record<string, string | number>>

/**
 * A reminder to send at `fireAt`; `nominalFireAt` is when it would fire
 * without quiet hours (the dedupe key). `titleKey`/`bodyKey` are catalog-neutral
 * i18n keys (`reminders.<kind>.title`) rendered with `params`; `url` is a
 * path of the web app, opened when the notification is tapped.
 */
export interface PlannedReminder {
  kind: ReminderKind
  tripId: string
  refId: string
  fireAt: IsoInstant
  nominalFireAt: IsoInstant
  titleKey: string
  bodyKey: string
  params: ReminderParams
  url: string
}

export const REMINDER_HORIZON_HOURS = 36

/** Event kinds that get a "time to leave" reminder. */
export const LEAVE_AT_KINDS: readonly EventKind[] = ['flight', 'train', 'ferry', 'bus']

/** Local time of the daily task digest. */
export const TASK_DIGEST_LOCAL_TIME = '09:00'

/** A check-out before this local time is announced at `EARLY_CHECK_OUT_NOTICE` instead. */
const EARLY_CHECK_OUT_BEFORE_MIN = 10 * 60
const EARLY_CHECK_OUT_NOTICE = '08:00'
const CHECK_OUT_NOTICE_MIN = 60
const DIGEST_MAX_TITLES = 3
const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

interface QuietHours {
  startMin: number
  endMin: number
  end: string
}

function minutesOf(value: string | null): number | null {
  const match = value === null ? null : HH_MM.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** Quiet hours when both ends are well-formed and differ; anything else means none. */
function quietHoursOf(settings: ReminderSettings): QuietHours | null {
  const startMin = minutesOf(settings.quietHoursStart)
  const endMin = minutesOf(settings.quietHoursEnd)
  if (startMin === null || endMin === null || startMin === endMin) {
    return null
  }
  return { startMin, endMin, end: settings.quietHoursEnd! }
}

/**
 * `fireMs` moved to the end of the quiet hours it falls in, read with
 * `offsetMin`. A window crossing midnight (22:00–07:00) ends the next local
 * day for a time after its start. A move to `deadlineMs` or later is not
 * made: the reminder keeps its original time.
 */
function afterQuietHours(
  fireMs: number,
  offsetMin: number,
  quiet: QuietHours | null,
  deadlineMs: number
): number {
  if (!quiet) {
    return fireMs
  }
  const zoned = { at: new Date(fireMs).toISOString(), offsetMin }
  const minute = localMinutesOfDay(zoned)
  const day = localDate(zoned)
  let endDay: IsoDate | null = null
  if (quiet.startMin < quiet.endMin) {
    if (minute >= quiet.startMin && minute < quiet.endMin) endDay = day
  } else if (minute >= quiet.startMin) {
    endDay = addDays(day, 1)
  } else if (minute < quiet.endMin) {
    endDay = day
  }
  if (endDay === null) {
    return fireMs
  }
  const movedMs = instantOfLocalMs(`${endDay}T${quiet.end}`, offsetMin)
  return movedMs < deadlineMs ? movedMs : fireMs
}

function hhmm(ms: number, offsetMin: number): string {
  return localDateTime({ at: new Date(ms).toISOString(), offsetMin }).slice(11, 16)
}

interface Draft {
  kind: ReminderKind
  tripId: string
  refId: string
  fireMs: number
  nominalMs: number
  params: ReminderParams
  url: string
}

function leaveAtDrafts(trip: ReminderTrip, quiet: QuietHours | null): Draft[] {
  const drafts: Draft[] = []
  for (const event of trip.events) {
    if (!isActiveEvent(event) || !LEAVE_AT_KINDS.includes(event.kind)) {
      continue
    }
    const startsMs = epochMs(event.starts.at)
    const leaveMs = leaveAtMs(startsMs, event.kind, event.leaveBufferMin, event.travelMin)
    const offsetMin = event.starts.offsetMin
    drafts.push({
      kind: 'leave_at',
      tripId: trip.id,
      refId: event.id,
      fireMs: afterQuietHours(leaveMs, offsetMin, quiet, startsMs),
      nominalMs: leaveMs,
      params: {
        tripName: trip.name,
        title: event.title,
        leaveTime: hhmm(leaveMs, offsetMin),
        startTime: hhmm(startsMs, offsetMin),
      },
      url: `/t/${trip.id}/plan/e/${event.id}`,
    })
  }
  return drafts
}

/** The check-out notice: an hour before, or 08:00 local for a check-out before 10:00. */
function checkOutMs(ends: ZonedInstant): number {
  const endsMs = epochMs(ends.at)
  const hourBefore = endsMs - CHECK_OUT_NOTICE_MIN * MS_PER_MINUTE
  if (localMinutesOfDay(ends) >= EARLY_CHECK_OUT_BEFORE_MIN) {
    return hourBefore
  }
  const eight = instantOfLocalMs(`${localDate(ends)}T${EARLY_CHECK_OUT_NOTICE}`, ends.offsetMin)
  return eight < endsMs ? eight : hourBefore
}

function checkOutDrafts(trip: ReminderTrip, quiet: QuietHours | null): Draft[] {
  const drafts: Draft[] = []
  for (const event of trip.events) {
    if (!isActiveEvent(event) || event.kind !== 'lodging' || !event.ends) {
      continue
    }
    const endsMs = epochMs(event.ends.at)
    const offsetMin = event.ends.offsetMin
    const noticeMs = checkOutMs(event.ends)
    drafts.push({
      kind: 'check_out',
      tripId: trip.id,
      refId: event.id,
      fireMs: afterQuietHours(noticeMs, offsetMin, quiet, endsMs),
      nominalMs: noticeMs,
      params: {
        tripName: trip.name,
        title: event.title,
        checkOutTime: hhmm(endsMs, offsetMin),
      },
      url: `/t/${trip.id}/today`,
    })
  }
  return drafts
}

/** The trip-local offset of `day` at nine, through the same rule Today uses. */
function digestOffset(
  trip: ReminderTrip,
  offsetAt: ZoneOffsetResolver,
  day: IsoDate,
  hint: number
) {
  const guess = new Date(instantOfLocalMs(`${day}T${TASK_DIGEST_LOCAL_TIME}`, hint)).toISOString()
  const zone = tripLocalZone(
    {
      stops: trip.stops.map((stop) => ({ ...stop, offsetMin: offsetAt(stop.tz, guess) })),
      events: trip.events,
      homeTz: trip.homeTz,
      homeOffsetMin: offsetAt(trip.homeTz, guess),
    },
    guess
  )
  if (zone.source === 'event') {
    return zone.offsetMin
  }
  // The offset at nine itself, in case the zone changes between the guess and nine.
  const nine = new Date(
    instantOfLocalMs(`${day}T${TASK_DIGEST_LOCAL_TIME}`, zone.offsetMin)
  ).toISOString()
  return offsetAt(zone.tz, nine)
}

/** Open tasks due on `day` and open high-priority tasks already late, the late ones first. */
function tasksDueOn(tasks: readonly TripTask[], day: IsoDate): TripTask[] {
  const late: TripTask[] = []
  const due: TripTask[] = []
  for (const task of tasks) {
    const urgency = taskUrgency(task, day)
    if (urgency === 'today') due.push(task)
    if (urgency === 'overdue' && task.priority === 'high') late.push(task)
  }
  late.sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? ''))
  return [...late, ...due]
}

function taskDigestDrafts(
  trip: ReminderTrip,
  now: IsoInstant,
  offsetAt: ZoneOffsetResolver,
  quiet: QuietHours | null,
  horizonHours: number
): Draft[] {
  const zoneNow = tripLocalZone(
    {
      stops: trip.stops.map((stop) => ({ ...stop, offsetMin: offsetAt(stop.tz, now) })),
      events: trip.events,
      homeTz: trip.homeTz,
      homeOffsetMin: offsetAt(trip.homeTz, now),
    },
    now
  )
  const today = localDate({ at: now, offsetMin: zoneNow.offsetMin })
  const days = Math.ceil(horizonHours / 24) + 1
  const drafts: Draft[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i)
    if (day > trip.endsOn) {
      break
    }
    const tasks = tasksDueOn(trip.tasks, day)
    if (tasks.length === 0) {
      continue
    }
    const offsetMin = digestOffset(trip, offsetAt, day, zoneNow.offsetMin)
    const nineMs = instantOfLocalMs(`${day}T${TASK_DIGEST_LOCAL_TIME}`, offsetMin)
    const endOfDayMs = instantOfLocalMs(`${addDays(day, 1)}T00:00`, offsetMin)
    const shown = tasks.slice(0, DIGEST_MAX_TITLES)
    drafts.push({
      kind: 'tasks_due',
      tripId: trip.id,
      refId: `${trip.id}:${day}`,
      fireMs: afterQuietHours(nineMs, offsetMin, quiet, endOfDayMs),
      nominalMs: nineMs,
      params: {
        tripName: trip.name,
        count: tasks.length,
        titles: shown.map((task) => task.title).join(', '),
        more: tasks.length - shown.length,
      },
      url: `/t/${trip.id}/more/tasks`,
    })
  }
  return drafts
}

function compareDrafts(a: Draft, b: Draft): number {
  return (
    a.fireMs - b.fireMs ||
    a.tripId.localeCompare(b.tripId) ||
    a.kind.localeCompare(b.kind) ||
    a.refId.localeCompare(b.refId)
  )
}

/** Every reminder with `fireAt` in `[now, now + horizon)`, sorted by fire time. */
export function planReminders(input: ReminderPlanInput): PlannedReminder[] {
  const nowMs = epochMs(input.now)
  const horizonHours = input.horizonHours ?? REMINDER_HORIZON_HOURS
  const untilMs = nowMs + horizonHours * MS_PER_HOUR
  const quiet = quietHoursOf(input.settings)
  const drafts: Draft[] = []
  for (const trip of input.trips) {
    if (input.settings.leaveAt) drafts.push(...leaveAtDrafts(trip, quiet))
    if (input.settings.checkOut) drafts.push(...checkOutDrafts(trip, quiet))
    if (input.settings.tasksDue) {
      drafts.push(...taskDigestDrafts(trip, input.now, input.offsetAt, quiet, horizonHours))
    }
  }
  return drafts
    .filter((draft) => draft.fireMs >= nowMs && draft.fireMs < untilMs)
    .sort(compareDrafts)
    .map((draft) => ({
      kind: draft.kind,
      tripId: draft.tripId,
      refId: draft.refId,
      fireAt: new Date(draft.fireMs).toISOString(),
      nominalFireAt: new Date(draft.nominalMs).toISOString(),
      titleKey: `reminders.${draft.kind}.title`,
      bodyKey: `reminders.${draft.kind}.body`,
      params: draft.params,
      url: draft.url,
    }))
}
