/**
 * When to leave for an event: its start minus a buffer that depends on the
 * kind (airports need longer than a bus stop) minus the travel time to get
 * there. The event's own `leaveBufferMin` overrides the kind default.
 */
import type { EventKind } from './trip_event.ts'

/** Minutes before the start, by kind, when the event sets no buffer of its own. */
export const LEAVE_BUFFER_DEFAULT_MIN: Readonly<Record<EventKind, number>> = {
  flight: 150,
  train: 30,
  ferry: 45,
  bus: 20,
  car: 15,
  lodging: 15,
  tour: 15,
  meal: 15,
  activity: 15,
  free_time: 15,
  other: 15,
}

const MS_PER_MINUTE = 60_000

export function leaveBufferMin(kind: EventKind, override?: number | null): number {
  return override ?? LEAVE_BUFFER_DEFAULT_MIN[kind]
}

/** Epoch milliseconds of the moment to leave. */
export function leaveAtMs(
  startsMs: number,
  kind: EventKind,
  bufferOverride?: number | null,
  travelMin?: number | null
): number {
  return startsMs - (leaveBufferMin(kind, bufferOverride) + (travelMin ?? 0)) * MS_PER_MINUTE
}
