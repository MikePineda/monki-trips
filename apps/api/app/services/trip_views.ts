import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { balances } from '@monkitrips/shared'
import type {
  TripBalancesView,
  TripBudgetView,
  TripNightsView,
  TripTodayView,
  TripEventRow,
} from '@monkitrips/shared'
import type Trip from '#models/trip'
import { Clock } from '#services/clock'
import { ownerTravellerId } from '#services/owner_traveller'
import { TripContent, type TripContentRows } from '#services/trip_content'
import Traveller from '#models/traveller'
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
 * The computed views of a trip (`/nights`, `/budget`, `/balances`, `/today`), built from
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
    return this.nightsOf(trip, await this.content.load(trip.id))
  }

  /** The nights view over rows the caller already has (the assistant diffs it before and after a proposal). */
  nightsOf(trip: Trip, { events }: Pick<TripContentRows, 'events'>): TripNightsView {
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
        kind: expense.kind,
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

  /**
   * Who owes whom, with the shared `balances` function the device runs
   * offline. An expense without a payer counts as the owner's, as the
   * switch to split assigns it.
   */
  async balances(trip: Trip): Promise<TripBalancesView> {
    const rows = await this.content.load(trip.id)
    const travellers = await Traveller.query()
      .where('trip_id', trip.id)
      .whereNull('deleted_at')
      .orderBy('position')
      .orderBy('created_at')
    const result = balances({
      travellers: travellers.map((traveller) => traveller.id),
      expenses: rows.expenses,
      shares: rows.expenseShares,
      defaultPayerTravellerId: await ownerTravellerId(db.connection(), trip.id),
    })
    const names = new Map(travellers.map((traveller) => [traveller.id, traveller.displayName]))
    return {
      baseCurrency: trip.baseCurrency,
      budgetMode: trip.budgetMode,
      balances: result.balances.map((row) => ({
        travellerId: row.travellerId,
        displayName: names.get(row.travellerId) ?? null,
        paidMinor: Number(row.paidMinor),
        owedMinor: Number(row.owedMinor),
        netMinor: Number(row.netMinor),
      })),
      settlements: result.settlements.map((transfer) => ({
        fromTravellerId: transfer.fromTravellerId,
        toTravellerId: transfer.toTravellerId,
        amountMinor: Number(transfer.amountMinor),
      })),
      pendingFxCount: result.pendingFxCount,
      unassignedCount: result.unassignedCount,
    }
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
