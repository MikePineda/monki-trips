import type {
  ReminderTrip,
  TripEvent,
  TripEventRow,
  TripStop,
  TripStopRow,
  TripTask,
  TripTaskRow,
  ZonedInstant,
} from '@monkitrips/shared'
import { zoneOffsetAt } from '#domain/zone_offset'

/** The trip fields the planner reads. */
export interface ReminderTripHeader {
  id: string
  name: string
  startsOn: string
  endsOn: string
  homeTz: string
}

/** The live content rows the planner reads, in wire shape. */
export interface ReminderTripRows {
  stops: readonly TripStopRow[]
  events: readonly TripEventRow[]
  tasks: readonly TripTaskRow[]
}

function zoned(at: string, tz: string): ZonedInstant {
  return { at, offsetMin: zoneOffsetAt(tz, at), tz }
}

function toEvent(row: TripEventRow, homeTz: string): TripEvent | null {
  if (!row.startsAt) return null
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    stopId: row.stopId,
    starts: zoned(row.startsAt, row.startTz ?? homeTz),
    ends: row.endsAt ? zoned(row.endsAt, row.endTz ?? row.startTz ?? homeTz) : null,
    leaveBufferMin: row.leaveBufferMin ?? null,
    travelMin: row.travelMin ?? null,
  }
}

function toStop(row: TripStopRow): TripStop | null {
  if (!row.tz || !row.arriveOn || !row.departOn) return null
  return {
    id: row.id,
    position: row.position,
    name: row.name,
    countryCode: row.countryCode,
    tz: row.tz,
    arriveOn: row.arriveOn,
    departOn: row.departOn,
  }
}

function toTask(row: TripTaskRow): TripTask {
  return {
    id: row.id,
    title: row.title,
    titleKey: row.titleKey ?? null,
    dueOn: row.dueOn,
    priority: row.priority,
    doneAt: row.doneAt,
    origin: row.origin,
  }
}

/**
 * A trip and its live rows as the reminder planner reads them: instants
 * become `ZonedInstant`s with the offset their zone had at that instant
 * (Luxon); undated events and stops without a zone or dates drop out.
 */
export function toReminderTrip(trip: ReminderTripHeader, rows: ReminderTripRows): ReminderTrip {
  return {
    id: trip.id,
    name: trip.name,
    startsOn: trip.startsOn,
    endsOn: trip.endsOn,
    homeTz: trip.homeTz,
    stops: rows.stops.map(toStop).filter((stop): stop is TripStop => stop !== null),
    events: rows.events
      .map((row) => toEvent(row, trip.homeTz))
      .filter((event): event is TripEvent => event !== null),
    tasks: rows.tasks.map(toTask),
  }
}
