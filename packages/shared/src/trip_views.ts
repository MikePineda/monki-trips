/**
 * The view DTOs of `GET /trips/:tripId/{nights,budget,today}`: what the API
 * returns, with minor units as JSON numbers. They carry a `Trip` prefix so
 * they never collide with the results of the domain pipelines for the same
 * screens (`NightCoverage`, `BudgetStatus`, `TodayView` in `domain/`).
 */
import type { IsoDate } from './domain/iso_date.ts'
import type { TaskUrgency } from './domain/task_urgency.ts'
import type { EventKind } from './domain/trip_event.ts'
import type { IsoInstant } from './domain/zoned_instant.ts'

/**
 * One night of the trip (`GET /trips/:tripId/nights`): the date the night
 * starts on and what covers it. An uncovered night is the alert "where do we
 * sleep?".
 */
export interface TripNight {
  /** The day the night starts (`YYYY-MM-DD`), from `startsOn` to `endsOn - 1`. */
  date: IsoDate
  covered: boolean
  /** The lodging or transport that covers it, if any. */
  coveredBy: { eventId: string; kind: EventKind; title: string } | null
}

export interface TripNightsView {
  nights: TripNight[]
  uncoveredCount: number
}

/** Budget position in base minor units (`GET /trips/:tripId/budget`). */
export interface TripBudgetView {
  baseCurrency: string
  budgetMinor: number | null
  /** Sum of every converted expense (refunds subtract). */
  spentMinor: number
  /** `budget - spent`, or null without a budget. */
  remainingMinor: number | null
  /** What may be spent per remaining day (today included), or null outside the trip or without a budget. */
  allowanceTodayMinor: number | null
  spentTodayMinor: number
  /** `allowanceToday - spentToday`, or null when there is no allowance. */
  leftTodayMinor: number | null
  /** Expenses still waiting for an exchange rate; they are not in `spentMinor`. */
  pendingFxCount: number
  /** Converted cost of booked/paid events, for the "committed" line. */
  committedMinor: number
  perCategory: { categoryId: string | null; budgetMinor: number | null; spentMinor: number }[]
}

/** What Today shows (`GET /trips/:tripId/today?at=`). */
export interface TripTodayView {
  /** The instant the view was computed for. */
  at: IsoInstant
  /** Zone Today follows: the stop covering `at`, else the last started event, else `homeTz`. */
  tz: string
  /** Local date in `tz`. */
  date: IsoDate
  nextEvent: {
    eventId: string
    segmentId: string | null
    title: string
    kind: EventKind
    startsAt: string
    /** `startsAt - buffer - travel`, when to leave. */
    leaveAt: string
    /** Milliseconds until `startsAt`. */
    countdownMs: number
  } | null
  todayEventIds: string[]
  todayDocumentIds: string[]
  /** The lodging or transport covering tonight, if any. */
  sleepingAt: { eventId: string; kind: EventKind; title: string } | null
  leftTodayMinor: number | null
  tasks: { taskId: string; urgency: TaskUrgency }[]
}
