import {
  instantOfLocal,
  isDone,
  mascotState,
  todayView,
  type BudgetExpense,
  type DocumentTag,
  type IsoDate,
  type MascotInput,
  type MascotState,
  type TaskOrigin,
  type TaskPriority,
  type TodayStop,
  type TodayView,
  type TripTask,
  type WeatherSnapshot,
} from '@monkitrips/shared'
import { documentOfflineState, type OfflineStateDocument } from './document-offline-state'
import type { NeededDocument, NeededDocumentInput } from './documents-needed-today'
import { toDomainEvents, type EventRow, type SegmentRow } from './event-instants'
import { isKnownZone, zoneOffsetMinutes } from './zoned-time'

/**
 * Today, read from the device's rows: the stored rows become the shared
 * pipelines' input (zones resolved with `Intl` at `now`), `today_view`
 * computes the screen and `mascot_state` the mood. Nothing here is
 * recomputed by hand; this module only adapts shapes. Pure: `now` and
 * every row are parameters.
 *
 * The documents of the day are the vault's (`DocumentsStore
 * .documentsNeededToday` for `view.today`), not the view's: the page
 * reads them after the screen, `todayDocuments` adds whether the device
 * holds each verified copy, and `todayMascot` gives the mood with them.
 *
 * Before the trip the screen is a preview of day 1: the day, documents
 * and tonight are read at the start of the first day, the next event and
 * its countdown at the real `now`.
 */

/** The trip row as the device keeps it (only what Today reads). */
export interface TodayTripRow {
  startDate: IsoDate
  endDate: IsoDate
  baseCurrency: string
  budgetTotalMinor?: number | null
  homeTz?: string
}

export interface TodayStopRow {
  id: string
  position: number
  name: string
  countryCode: string | null
  tz: string | null
  arriveOn: IsoDate | null
  departOn: IsoDate | null
}

export interface TodayTaskRow {
  id: string
  title: string
  titleKey: string | null
  dueOn: IsoDate | null
  priority: TaskPriority
  doneAt: string | null
  origin: TaskOrigin
  sourceDocumentId: string | null
  eventId: string | null
}

export interface TodayExpenseRow {
  id: string
  eventId: string | null
  amountMinor: number
  currency: string
  baseAmountMinor: number | null
  fxRate: string | null
  spentOn: IsoDate
  updatedAt: string
  syncState?: 'pending' | 'failed'
}

export interface TodayScreenInput<W extends WeatherSnapshot = WeatherSnapshot> {
  trip: TodayTripRow
  stops: readonly TodayStopRow[]
  events: readonly EventRow[]
  segments: readonly SegmentRow[]
  tasks: readonly TodayTaskRow[]
  expenses: readonly TodayExpenseRow[]
  weather?: W | null
  now: string
  /** The device's zone: the trip's home zone when the trip row has none. */
  deviceZone: string
}

export interface TodayScreen<W extends WeatherSnapshot = WeatherSnapshot> {
  /** The day; its documents are `todayDocuments` of the vault's list for `view.today`. */
  view: Omit<TodayView<W>, 'documents'>
  /** True before the trip: the screen previews day 1. */
  preview: boolean
  /** What `mascot_state` reads, but the documents of the day (see `todayMascot`). */
  mascotInput: Omit<MascotInput, 'todayDocuments'>
  /** The open "print this" task of each document, by document id. */
  printTasks: Record<string, string>
}

/** The device's document row, as far as Today reads it (a `DocRecord` is one). */
export interface TodayDocumentRow extends NeededDocumentInput, OfflineStateDocument {
  title: string
}

/** A document of the day: why it shows, and whether the device holds its verified copy. */
export interface TodayDocumentLine {
  id: string
  title: string
  tags: readonly DocumentTag[]
  reasons: readonly DocumentTag[]
  /** A saved copy whose sha256 is the server's; a link never is. */
  availableOffline: boolean
}

/**
 * The documents `documentsNeededToday` picked, with their offline state
 * read from the saved copies (`documentOfflineState`), the ones to print
 * first like their bands (DESIGN.md, Today).
 */
export function todayDocuments(
  needed: readonly NeededDocument<TodayDocumentRow>[],
  copies: ReadonlyMap<string, { sha256: string }>
): TodayDocumentLine[] {
  const lines = needed.map(({ document, reasons }) => ({
    id: document.id,
    title: document.title,
    tags: document.tags,
    reasons,
    availableOffline:
      documentOfflineState(document, copies.get(document.id) ?? null, false) === 'saved',
  }))
  return lines.sort(
    (a, b) => Number(b.reasons.includes('print')) - Number(a.reasons.includes('print'))
  )
}

/** Kiko's mood for the screen, with the documents of the day. */
export function todayMascot(
  screen: Pick<TodayScreen, 'mascotInput'>,
  documents: readonly Pick<TodayDocumentLine, 'tags' | 'availableOffline'>[]
): MascotState {
  return mascotState({ ...screen.mascotInput, todayDocuments: documents })
}

function zoneOrUtc(zone: string | null | undefined): string {
  return zone && isKnownZone(zone) ? zone : 'UTC'
}

function domainStops(stops: readonly TodayStopRow[], atMs: number): TodayStop[] {
  return stops.flatMap((stop) => {
    if (!stop.tz || !stop.arriveOn || !stop.departOn || !isKnownZone(stop.tz)) {
      return []
    }
    return [
      {
        id: stop.id,
        position: stop.position,
        name: stop.name,
        countryCode: stop.countryCode,
        tz: stop.tz,
        arriveOn: stop.arriveOn,
        departOn: stop.departOn,
        offsetMin: zoneOffsetMinutes(stop.tz, atMs),
      },
    ]
  })
}

function domainTasks(tasks: readonly TodayTaskRow[]): TripTask[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    titleKey: task.titleKey,
    dueOn: task.dueOn,
    priority: task.priority,
    doneAt: task.doneAt,
    origin: task.origin,
    sourceDocumentId: task.sourceDocumentId,
    eventId: task.eventId,
  }))
}

/** Expenses as `budget_status` takes them; one still in the outbox counts all the same. */
export function budgetExpenses(expenses: readonly TodayExpenseRow[]): BudgetExpense[] {
  return expenses.map((expense) => ({
    id: expense.id,
    eventId: expense.eventId,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    baseAmountMinor: expense.baseAmountMinor,
    spentOn: expense.spentOn,
    syncPending: expense.syncState === 'pending',
  }))
}

/** The instant day 1 starts, in the zone of the first stop (else the home zone). */
function firstDayStart(input: TodayScreenInput, homeZone: string): string {
  const first = [...input.stops]
    .filter((stop) => stop.tz && isKnownZone(stop.tz))
    .sort((a, b) => a.position - b.position)[0]
  const zone = first?.tz ?? homeZone
  const local = `${input.trip.startDate}T00:00`
  const wallMs = Date.parse(`${local}:00Z`)
  return instantOfLocal(local, zoneOffsetMinutes(zone, wallMs))
}

export function todayScreen<W extends WeatherSnapshot>(input: TodayScreenInput<W>): TodayScreen<W> {
  const homeZone = zoneOrUtc(input.trip.homeTz ?? input.deviceZone)
  const events = toDomainEvents(input.events, input.segments)
  const tasks = domainTasks(input.tasks)
  const expenses = budgetExpenses(input.expenses)

  const viewAt = (now: string) => {
    const nowMs = Date.parse(now)
    return todayView<W>({
      trip: {
        startsOn: input.trip.startDate,
        endsOn: input.trip.endDate,
        homeTz: homeZone,
        homeOffsetMin: zoneOffsetMinutes(homeZone, nowMs),
        baseCurrency: input.trip.baseCurrency,
        budgetTotalMinor: input.trip.budgetTotalMinor ?? null,
      },
      stops: domainStops(input.stops, nowMs),
      events,
      // Today's documents are the vault's (`documentsNeededToday`), read by the page.
      documents: [],
      expenses,
      weather: input.weather ?? null,
      now,
    })
  }

  const live = viewAt(input.now)
  const preview = live.phase === 'upcoming'
  const { documents: _none, ...view } = preview
    ? { ...viewAt(firstDayStart(input, homeZone)), nextEvent: live.nextEvent, now: live.now }
    : live
  void _none

  const mascotInput = {
    trip: { startsOn: input.trip.startDate, endsOn: input.trip.endDate },
    now: input.now,
    offsetMin: live.offsetMin,
    events,
    budget: live.budget,
    tasks,
  }

  const printTasks: Record<string, string> = {}
  for (const task of tasks) {
    if (task.origin === 'document' && task.sourceDocumentId && !isDone(task)) {
      printTasks[task.sourceDocumentId] = task.id
    }
  }

  return { view, preview, mascotInput, printTasks }
}
