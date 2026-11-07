import {
  instantOfLocal,
  isDone,
  mascotState,
  todayView,
  type BudgetExpense,
  type DocumentKind,
  type DocumentTag,
  type IsoDate,
  type MascotState,
  type TaskOrigin,
  type TaskPriority,
  type TodayStop,
  type TodayView,
  type TripDocument,
  type TripTask,
  type WeatherSnapshot,
} from '@monkitrips/shared'
import { toDomainEvents, type EventRow, type SegmentRow } from './event-instants'
import { isKnownZone, zoneOffsetMinutes } from './zoned-time'

/**
 * Today, read from the device's rows: the stored rows become the shared
 * pipelines' input (zones resolved with `Intl` at `now`), `today_view`
 * computes the screen and `mascot_state` the mood. Nothing here is
 * recomputed by hand; this module only adapts shapes. Pure: `now` and
 * every row are parameters.
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

export interface TodayDocRow {
  id: string
  eventId: string | null
  kind: DocumentKind
  title: string
  tags: readonly DocumentTag[]
  sha256: string | null
}

/** A document's bytes saved on the device, with the hash they were verified against. */
export interface SavedBlob {
  docId: string
  sha256: string
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
  docs: readonly TodayDocRow[]
  blobs: readonly SavedBlob[]
  tasks: readonly TodayTaskRow[]
  expenses: readonly TodayExpenseRow[]
  weather?: W | null
  now: string
  /** The device's zone: the trip's home zone when the trip row has none. */
  deviceZone: string
}

export interface TodayScreen<W extends WeatherSnapshot = WeatherSnapshot> {
  view: TodayView<W>
  /** True before the trip: the screen previews day 1. */
  preview: boolean
  mascot: MascotState
  /** The open "print this" task of each document, by document id. */
  printTasks: Record<string, string>
}

/** A document is offline when the device holds bytes whose hash is the server's. Links never are. */
export function isSavedOffline(doc: TodayDocRow, blobs: readonly SavedBlob[]): boolean {
  if (doc.kind !== 'file' || !doc.sha256) {
    return false
  }
  return blobs.some((blob) => blob.docId === doc.id && blob.sha256 === doc.sha256)
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

function domainDocuments(
  docs: readonly TodayDocRow[],
  blobs: readonly SavedBlob[]
): TripDocument[] {
  return docs.map((doc) => ({
    id: doc.id,
    eventId: doc.eventId,
    title: doc.title,
    tags: doc.tags,
    availableOffline: isSavedOffline(doc, blobs),
  }))
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
  const documents = domainDocuments(input.docs, input.blobs)
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
      documents,
      expenses,
      weather: input.weather ?? null,
      now,
    })
  }

  const live = viewAt(input.now)
  const preview = live.phase === 'upcoming'
  const view = preview
    ? { ...viewAt(firstDayStart(input, homeZone)), nextEvent: live.nextEvent, now: live.now }
    : live

  const mascot = mascotState({
    trip: { startsOn: input.trip.startDate, endsOn: input.trip.endDate },
    now: input.now,
    offsetMin: live.offsetMin,
    events,
    budget: live.budget,
    tasks,
    todayDocuments: view.documents,
  })

  const printTasks: Record<string, string> = {}
  for (const task of tasks) {
    if (task.origin === 'document' && task.sourceDocumentId && !isDone(task)) {
      printTasks[task.sourceDocumentId] = task.id
    }
  }

  return { view, preview, mascot, printTasks }
}
