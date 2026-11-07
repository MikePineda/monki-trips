/**
 * The mascot's mood on Today, by priority:
 *   celebrating  up to seven days after the trip ends
 *   asleep       `now` inside a night-covering transport, or 22:00–06:00 local
 *   worried      spent above 90 % of a positive budget, an overdue `high`
 *                task, or a `print`/`show_on_phone` document for today that
 *                is not available offline
 *   excited      a transport event today, or the departure day
 *   happy        otherwise
 * `thinking` is set by the UI while the AI works and never computed here.
 */
import type { BudgetStatus } from './budget_status.ts'
import { addDays, compareIsoDate, type IsoDate } from './iso_date.ts'
import { isNightTransport } from './night_coverage.ts'
import { hasOverdueHighTask } from './task_urgency.ts'
import { tripNightDates, type TripDates } from './trip_dates.ts'
import { hasTag, type TripDocument } from './trip_document.ts'
import { eventDay, isActiveEvent, isTransportKind, type TripEvent } from './trip_event.ts'
import type { TripTask } from './trip_task.ts'
import { epochMs, localDate, localMinutesOfDay, type IsoInstant } from './zoned_instant.ts'

export const MASCOT_STATES = [
  'happy',
  'worried',
  'excited',
  'asleep',
  'celebrating',
  'thinking',
] as const

export type MascotState = (typeof MASCOT_STATES)[number]

/** Days after `endsOn` during which the mascot still celebrates. */
export const CELEBRATION_DAYS = 7

/** Local minutes of day; the mascot sleeps from 22:00 up to 06:00. */
export const ASLEEP_FROM_MIN = 22 * 60
export const ASLEEP_UNTIL_MIN = 6 * 60

/** Spending above this share of the budget worries the mascot (90 %). */
export const WORRY_SPEND_RATIO = { numerator: 9n, denominator: 10n } as const

export interface MascotInput {
  trip: TripDates
  now: IsoInstant
  /** UTC offset of Today's zone at `now`, minutes east of UTC. */
  offsetMin: number
  events: readonly TripEvent[]
  budget: Pick<BudgetStatus, 'budgetMinor' | 'spentMinor'> | null
  tasks: readonly TripTask[]
  /** The documents Today shows (see `today_view`); only tags and offline state matter. */
  todayDocuments: readonly Pick<TripDocument, 'tags' | 'availableOffline'>[]
}

export function isCelebrating(trip: TripDates, today: IsoDate): boolean {
  return (
    compareIsoDate(today, trip.endsOn) > 0 &&
    compareIsoDate(today, addDays(trip.endsOn, CELEBRATION_DAYS)) <= 0
  )
}

export function isAsleep(
  input: Pick<MascotInput, 'trip' | 'now' | 'offsetMin' | 'events'>
): boolean {
  const nowMs = epochMs(input.now)
  const nights = tripNightDates(input.trip)
  const onBoard = input.events.some(
    (event) =>
      isActiveEvent(event) &&
      event.ends !== null &&
      epochMs(event.starts.at) <= nowMs &&
      nowMs <= epochMs(event.ends.at) &&
      isNightTransport(event, nights)
  )
  if (onBoard) {
    return true
  }
  const minutes = localMinutesOfDay({ at: input.now, offsetMin: input.offsetMin })
  return minutes >= ASLEEP_FROM_MIN || minutes < ASLEEP_UNTIL_MIN
}

export function isOverSpendThreshold(budget: MascotInput['budget']): boolean {
  if (!budget || budget.budgetMinor === null || budget.budgetMinor <= 0n) {
    return false
  }
  return (
    budget.spentMinor * WORRY_SPEND_RATIO.denominator >
    budget.budgetMinor * WORRY_SPEND_RATIO.numerator
  )
}

export function hasDocumentMissingOffline(documents: MascotInput['todayDocuments']): boolean {
  return documents.some(
    (document) =>
      !document.availableOffline && (hasTag(document, 'print') || hasTag(document, 'show_on_phone'))
  )
}

export function isWorried(input: MascotInput, today: IsoDate): boolean {
  return (
    isOverSpendThreshold(input.budget) ||
    hasOverdueHighTask(input.tasks, today) ||
    hasDocumentMissingOffline(input.todayDocuments)
  )
}

export function isExcited(input: Pick<MascotInput, 'trip' | 'events'>, today: IsoDate): boolean {
  if (today === input.trip.startsOn) {
    return true
  }
  return input.events.some(
    (event) => isActiveEvent(event) && isTransportKind(event.kind) && eventDay(event) === today
  )
}

export function mascotState(input: MascotInput): MascotState {
  const today = localDate({ at: input.now, offsetMin: input.offsetMin })
  if (isCelebrating(input.trip, today)) {
    return 'celebrating'
  }
  if (isAsleep(input)) {
    return 'asleep'
  }
  if (isWorried(input, today)) {
    return 'worried'
  }
  if (isExcited(input, today)) {
    return 'excited'
  }
  return 'happy'
}
