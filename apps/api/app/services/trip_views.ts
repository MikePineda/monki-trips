import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import type {
  TripBudgetView,
  TripNightsView,
  TripTodayView,
  TripEventRow,
} from '@monkitrips/shared'
import type Trip from '#models/trip'
import { Clock } from '#services/clock'
import { TripContent, type TripContentRows } from '#services/trip_content'
import { budgetStatus } from '#domain/budget_status'
import { nightCoverage, type NightEvent } from '#domain/night_coverage'
import { todayView, todayZone, type TodayEvent } from '#domain/today_view'

/** The slice of an event the night and Today rules read. */
function nightEvent(event: TripEventRow): NightEvent {
  return {
    id: event.id,
    kind: event.kind,
    status: event.status,
    title: event.title,
    startsOn: event.startsOn,
    endsOn: event.endsLocal ? event.endsLocal.slice(0, 10) : null,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    startTz: event.startTz,
    coversNight: event.coversNight,
  }
}

/**
 * The computed views of a trip (`/nights`, `/budget`, `/today`), built from
 * the same pure functions the client runs offline, over the trip's live
 * content. "Now" always comes from the clock.
 */
@inject()
export class TripViews {
  constructor(
    private readonly clock: Clock,
    private readonly content: TripContent
  ) {}

  async nights(trip: Trip): Promise<TripNightsView> {
    const { events } = await this.content.load(trip.id)
    const nights = nightCoverage({
      startsOn: trip.startsOn.toISODate()!,
      endsOn: trip.endsOn.toISODate()!,
      homeTz: trip.homeTz,
      events: events.map(nightEvent),
    })
    return { nights, uncoveredCount: nights.filter((night) => !night.covered).length }
  }

  async budget(trip: Trip, today?: string, content?: TripContentRows): Promise<TripBudgetView> {
    const rows = content ?? (await this.content.load(trip.id))
    return budgetStatus({
      baseCurrency: trip.baseCurrency,
      budgetMinor: trip.budgetTotalMinor,
      startsOn: trip.startsOn.toISODate()!,
      endsOn: trip.endsOn.toISODate()!,
      today: today ?? DateTime.fromJSDate(this.clock.now()).setZone(trip.homeTz).toISODate()!,
      expenses: rows.expenses.map((expense) => ({
        categoryId: expense.categoryId,
        baseAmountMinor: expense.baseAmountMinor,
        spentOn: expense.spentOn,
      })),
      events: rows.events.map((event) => ({
        status: event.status,
        costMinor: event.costMinor,
        costCurrency: event.costCurrency,
      })),
      categories: rows.budgetCategories.map((category) => ({
        id: category.id,
        budgetMinor: category.budgetMinor,
      })),
    })
  }

  async today(trip: Trip, at?: Date): Promise<TripTodayView> {
    const rows = await this.content.load(trip.id)
    const instant = (at ?? this.clock.now()).toISOString()
    const events: TodayEvent[] = rows.events.map((event) => ({
      ...nightEvent(event),
      leaveBufferMin: event.leaveBufferMin,
      travelMin: event.travelMin,
    }))
    const stops = rows.stops.map((stop) => ({
      id: stop.id,
      tz: stop.tz,
      arriveOn: stop.arriveOn,
      departOn: stop.departOn,
    }))
    const tz = todayZone({ at: instant, homeTz: trip.homeTz, stops, events })
    const date = DateTime.fromISO(instant).setZone(tz).toISODate()!
    const budget = await this.budget(trip, date, rows)
    return todayView({
      at: instant,
      homeTz: trip.homeTz,
      stops,
      events,
      segments: rows.segments.map((segment) => ({
        id: segment.id,
        eventId: segment.eventId,
        departsAt: segment.departsAt,
      })),
      documents: rows.documents.map((document) => ({
        id: document.id,
        eventId: document.eventId,
        tags: document.tags,
      })),
      tasks: rows.tasks.map((task) => ({
        id: task.id,
        dueOn: task.dueOn,
        done: task.doneAt !== null,
      })),
      leftTodayMinor: budget.leftTodayMinor,
    })
  }
}
