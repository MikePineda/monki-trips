import { computed, type Signal } from '@angular/core'
import { byTravellerOrder } from '../../domain/traveller-order'
import type { AiConversationRecord } from './ai-conversation-record'
import { liveSignalFor } from './live'
import type {
  BudgetCategoryRecord,
  DocRecord,
  EventRecord,
  ExpenseRecord,
  ExpenseShareRecord,
  MemberRecord,
  PhraseCardRecord,
  SeatRecord,
  SegmentRecord,
  StopRecord,
  TaskRecord,
  TravellerRecord,
  TripRecord,
} from './records'
import { weatherKey, type CachedWeather } from './weather'

/**
 * Live reads of one trip's content from the device, keyed by a trip id
 * signal (the route parameter). Each call opens one Dexie subscription
 * that follows every write; call them from an injection context.
 */
export function tripRecord(tripId: Signal<string>): Signal<TripRecord | null> {
  return liveSignalFor(tripId, async (db, id) => (await db.trips.get(id)) ?? null, null)
}

export function tripStops(tripId: Signal<string>): Signal<StopRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.stops.where('tripId').equals(id).toArray(), [])
}

export function tripEvents(tripId: Signal<string>): Signal<EventRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.events.where('tripId').equals(id).toArray(), [])
}

export function tripSegments(tripId: Signal<string>): Signal<SegmentRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.segments.where('tripId').equals(id).toArray(), [])
}

export function tripSeats(tripId: Signal<string>): Signal<SeatRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.seats.where('tripId').equals(id).toArray(), [])
}

export function tripMembers(tripId: Signal<string>): Signal<MemberRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.members.where('tripId').equals(id).toArray(), [])
}

export function tripTravellers(tripId: Signal<string>): Signal<TravellerRecord[]> {
  return liveSignalFor(
    tripId,
    async (db, id) =>
      (await db.travellers.where('tripId').equals(id).toArray()).sort(byTravellerOrder),
    []
  )
}

export function tripTasks(tripId: Signal<string>): Signal<TaskRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.tasks.where('tripId').equals(id).toArray(), [])
}

export function tripExpenses(tripId: Signal<string>): Signal<ExpenseRecord[]> {
  return liveSignalFor(tripId, (db, id) => db.expenses.where('tripId').equals(id).toArray(), [])
}

/** Every live share of the trip's expenses (split mode). */
export function tripExpenseShares(tripId: Signal<string>): Signal<ExpenseShareRecord[]> {
  return liveSignalFor(
    tripId,
    (db, id) => db.expenseShares.where('tripId').equals(id).toArray(),
    []
  )
}

/** The trip's budget lines in position order. */
export function tripBudgetCategories(tripId: Signal<string>): Signal<BudgetCategoryRecord[]> {
  return liveSignalFor(
    tripId,
    async (db, id) =>
      (await db.budgetCategories.where('tripId').equals(id).toArray()).sort(
        (a, b) => a.position - b.position || a.id.localeCompare(b.id)
      ),
    []
  )
}

/** The trip's documents, by title. */
export function tripDocuments(tripId: Signal<string>): Signal<DocRecord[]> {
  return liveSignalFor(
    tripId,
    async (db, id) =>
      (await db.docs.where('tripId').equals(id).toArray()).sort((a, b) =>
        a.title.localeCompare(b.title)
      ),
    []
  )
}

/** One document, live; `null` until the first answer, then `{ document }` (null when gone). */
export function documentRecord(
  docId: Signal<string>
): Signal<{ document: DocRecord | null } | null> {
  return liveSignalFor(
    docId,
    async (db, id) => ({ document: (await db.docs.get(id)) ?? null }),
    null
  )
}

/** The weather cached for a trip day, or null: Today hides the row without it. */
export function tripWeather(
  tripId: Signal<string>,
  date: Signal<string>
): Signal<CachedWeather | null> {
  const key = computed(() => (date() ? weatherKey(tripId(), date()) : ''))
  return liveSignalFor(
    key,
    async (db, id) =>
      id ? (((await db.meta.get(id))?.value as CachedWeather | undefined) ?? null) : null,
    null
  )
}

/** The trip's phrase card sets, one per language, by language tag. */
export function tripPhraseCards(tripId: Signal<string>): Signal<PhraseCardRecord[]> {
  return liveSignalFor(
    tripId,
    async (db, id) =>
      (await db.phraseCards.where('tripId').equals(id).toArray()).sort((a, b) =>
        a.language.localeCompare(b.language)
      ),
    []
  )
}

/** The member's cached assistant conversations of the trip, most recently used first. */
export function tripAiConversations(tripId: Signal<string>): Signal<AiConversationRecord[]> {
  return liveSignalFor(
    tripId,
    (db, id) =>
      db.aiConversations
        .where('[tripId+updatedAt]')
        .between([id, ''], [id, '￿'])
        .reverse()
        .toArray(),
    []
  )
}
