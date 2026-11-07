import type { EventKind } from './event.ts'

/**
 * One night of the trip (`GET /trips/:tripId/nights`): the date the night
 * starts on and what covers it. An uncovered night is the alert "where do we
 * sleep?".
 */
export interface NightCoverage {
  /** The day the night starts (`YYYY-MM-DD`), from `startsOn` to `endsOn - 1`. */
  date: string
  covered: boolean
  /** The lodging or transport that covers it, if any. */
  coveredBy: { eventId: string; kind: EventKind; title: string } | null
}

export interface NightsView {
  nights: NightCoverage[]
  uncoveredCount: number
}

/** Budget position in base minor units (`GET /trips/:tripId/budget`). */
export interface BudgetStatus {
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

export type TaskUrgency = 'overdue' | 'today' | 'this_week' | 'later' | 'no_date'

/** What Today shows (`GET /trips/:tripId/today?at=`). */
export interface TodayView {
  /** The instant the view was computed for. */
  at: string
  /** Zone Today follows: the stop covering `at`, else the last started event, else `homeTz`. */
  tz: string
  /** Local date in `tz`. */
  date: string
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
