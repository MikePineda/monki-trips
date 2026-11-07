import { DateTime } from 'luxon'
import type { DocumentTag, EventKind, EventStatus, TodayView } from '@monkitrips/shared'
import { eventCoversNight, type NightEvent } from '#domain/night_coverage'
import { taskUrgency } from '#domain/task_urgency'

export interface TodayStop {
  id: string
  tz: string | null
  arriveOn: string | null
  departOn: string | null
}

export interface TodayEvent extends NightEvent {
  leaveBufferMin: number | null
  travelMin: number | null
}

export interface TodaySegment {
  id: string
  eventId: string
  departsAt: string
}

export interface TodayDocument {
  id: string
  eventId: string | null
  tags: readonly DocumentTag[]
}

export interface TodayTask {
  id: string
  dueOn: string | null
  done: boolean
}

export interface TodayViewInput {
  /** The instant to compute the view for, ISO. */
  at: string
  homeTz: string
  stops: TodayStop[]
  events: TodayEvent[]
  segments: TodaySegment[]
  documents: TodayDocument[]
  tasks: TodayTask[]
  leftTodayMinor: number | null
}

/** Minutes to leave before a transport departs, by kind, when the event sets none. */
export const LEAVE_BUFFER_MIN: Readonly<Partial<Record<EventKind, number>>> = {
  flight: 150,
  train: 30,
  ferry: 45,
  bus: 20,
}

const DEFAULT_BUFFER_MIN = 15

const HIDDEN: ReadonlySet<EventStatus> = new Set(['cancelled'])

/** The buffer an event applies: its own, else its kind's default, else 15 minutes. */
export function leaveBufferMinutes(event: Pick<TodayEvent, 'kind' | 'leaveBufferMin'>): number {
  return event.leaveBufferMin ?? LEAVE_BUFFER_MIN[event.kind] ?? DEFAULT_BUFFER_MIN
}

/** When to leave for an event: its start minus the buffer and the travel time. */
export function leaveAt(
  event: Pick<TodayEvent, 'kind' | 'leaveBufferMin' | 'travelMin'>,
  startsAt: string
): string {
  return DateTime.fromISO(startsAt)
    .minus({ minutes: leaveBufferMinutes(event) + (event.travelMin ?? 0) })
    .toUTC()
    .toISO()!
}

/**
 * The zone Today reads the clock in: the stop whose stay covers the local
 * date, else the zone of the last event that has started, else the trip's
 * home zone.
 */
export function todayZone(
  input: Pick<TodayViewInput, 'at' | 'homeTz' | 'stops' | 'events'>
): string {
  const at = DateTime.fromISO(input.at)
  for (const stop of input.stops) {
    if (!stop.tz || !stop.arriveOn || !stop.departOn) continue
    const localDate = at.setZone(stop.tz).toISODate()!
    if (stop.arriveOn <= localDate && localDate <= stop.departOn) return stop.tz
  }
  const started = input.events
    .filter((event) => event.startsAt && event.startTz && DateTime.fromISO(event.startsAt) <= at)
    .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!))
  const last = started.at(-1)
  return last?.startTz ?? input.homeTz
}

/**
 * What the Today screen shows at one instant. The date follows the zone of
 * the stop covering `at`; the next event skips cancelled ones and may be a
 * segment of a multi-leg transport; documents resurface on their event's day
 * (`print`, `show_on_phone`) or on any flight day (`requires_passport`).
 * Mirrors the shared `today_view`.
 */
export function todayView(input: TodayViewInput): TodayView {
  const tz = todayZone(input)
  const at = DateTime.fromISO(input.at)
  const date = at.setZone(tz).toISODate()!
  const live = input.events.filter((event) => !HIDDEN.has(event.status))

  const todayEvents = live.filter((event) => event.startsOn === date)
  const todayEventIds = new Set(todayEvents.map((event) => event.id))
  const flightDay = todayEvents.some((event) => event.kind === 'flight')
  const todayDocumentIds = input.documents
    .filter(
      (document) =>
        (document.eventId !== null &&
          todayEventIds.has(document.eventId) &&
          (document.tags.includes('print') || document.tags.includes('show_on_phone'))) ||
        (flightDay && document.tags.includes('requires_passport'))
    )
    .map((document) => document.id)

  type Upcoming = { eventId: string; segmentId: string | null; startsAt: string; event: TodayEvent }
  const upcoming: Upcoming[] = []
  for (const event of live) {
    const segments = input.segments
      .filter((segment) => segment.eventId === event.id)
      .sort((a, b) => a.departsAt.localeCompare(b.departsAt))
    if (segments.length > 0) {
      for (const segment of segments) {
        upcoming.push({
          eventId: event.id,
          segmentId: segment.id,
          startsAt: segment.departsAt,
          event,
        })
      }
    } else if (event.startsAt) {
      upcoming.push({ eventId: event.id, segmentId: null, startsAt: event.startsAt, event })
    }
  }
  const next = upcoming
    .filter((candidate) => DateTime.fromISO(candidate.startsAt) >= at)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]

  const tonight =
    live.find((event) => event.kind === 'lodging' && eventCoversNight(event, date, input.homeTz)) ??
    live.find((event) => eventCoversNight(event, date, input.homeTz)) ??
    null

  return {
    at: at.toUTC().toISO()!,
    tz,
    date,
    nextEvent: next
      ? {
          eventId: next.eventId,
          segmentId: next.segmentId,
          title: next.event.title,
          kind: next.event.kind,
          startsAt: DateTime.fromISO(next.startsAt).toUTC().toISO()!,
          leaveAt: leaveAt(next.event, next.startsAt),
          countdownMs: DateTime.fromISO(next.startsAt).toMillis() - at.toMillis(),
        }
      : null,
    todayEventIds: [...todayEventIds],
    todayDocumentIds,
    sleepingAt: tonight ? { eventId: tonight.id, kind: tonight.kind, title: tonight.title } : null,
    leftTodayMinor: input.leftTodayMinor,
    tasks: input.tasks
      .filter((task) => !task.done)
      .map((task) => ({ taskId: task.id, urgency: taskUrgency(task.dueOn, date) })),
  }
}
