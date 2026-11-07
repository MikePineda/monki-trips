import {
  TRIP_JSON_SCHEMA_VERSION,
  TRIP_JSON_VERSION,
  type TripJsonBudgetCategory,
  type TripJsonDocument,
  type TripJsonEvent,
  type TripJsonExpense,
  type TripJsonSegment,
  type TripJsonStop,
  type TripJsonTask,
  type TripJsonTraveller,
  type TripJsonV1,
} from '@monkitrips/shared'

/** A document that passed the JSON Schema: required keys present, optional ones maybe missing. */
type Loose<T> = { [K in keyof T]?: T[K] | undefined }

function list<T>(value: readonly T[] | undefined): T[] {
  return value ? [...value] : []
}

function text(value: string | null | undefined): string | null {
  return value ?? null
}

/**
 * Fills in what a hand-written file may leave out, so the planner and the
 * entity validators always see a complete document: arrays default to
 * empty, nullable fields to null, positions to the row's index, statuses and
 * priorities to their everyday values. `homeTz` falls back to the caller's
 * zone. Must run after the schema check (it trusts the types).
 */
export function withTripJsonDefaults(
  raw: Loose<TripJsonV1>,
  fallback: { homeTz: string }
): TripJsonV1 {
  const trip = raw.trip as Loose<TripJsonV1['trip']>
  const segment = (leg: Loose<TripJsonSegment>, index: number): TripJsonSegment => ({
    ref: leg.ref!,
    position: leg.position ?? index + 1,
    carrier: text(leg.carrier),
    number: text(leg.number),
    originName: text(leg.originName),
    originCode: text(leg.originCode),
    originLat: leg.originLat ?? null,
    originLng: leg.originLng ?? null,
    destName: text(leg.destName),
    destCode: text(leg.destCode),
    destLat: leg.destLat ?? null,
    destLng: leg.destLng ?? null,
    departsLocal: leg.departsLocal!,
    departsTz: leg.departsTz!,
    arrivesLocal: leg.arrivesLocal!,
    arrivesTz: leg.arrivesTz!,
    seats: list(leg.seats).map((seat) => ({
      travellerRef: seat.travellerRef,
      seat: text(seat.seat),
      coach: text(seat.coach),
      ticketNumber: text(seat.ticketNumber),
      documentRef: text(seat.documentRef),
    })),
  })
  return {
    version: TRIP_JSON_VERSION,
    schemaVersion: TRIP_JSON_SCHEMA_VERSION,
    exportedAt: raw.exportedAt ?? '',
    trip: {
      name: trip.name!,
      baseCurrency: trip.baseCurrency!.toUpperCase(),
      budgetMode: trip.budgetMode ?? 'shared',
      budgetTotalMinor: trip.budgetTotalMinor ?? null,
      startsOn: trip.startsOn!,
      endsOn: trip.endsOn!,
      homeTz: trip.homeTz ?? fallback.homeTz,
    },
    members: list(raw.members),
    travellers: list(raw.travellers).map(
      (traveller: Loose<TripJsonTraveller>, index): TripJsonTraveller => ({
        ref: traveller.ref!,
        displayName: traveller.displayName!,
        position: traveller.position ?? index,
      })
    ),
    stops: list(raw.stops).map((stop: Loose<TripJsonStop>, index): TripJsonStop => ({
      ref: stop.ref!,
      position: stop.position ?? index,
      name: stop.name!,
      countryCode: stop.countryCode?.toUpperCase() ?? null,
      lat: stop.lat ?? null,
      lng: stop.lng ?? null,
      tz: text(stop.tz),
      arriveOn: text(stop.arriveOn),
      departOn: text(stop.departOn),
    })),
    events: list(raw.events).map((event: Loose<TripJsonEvent>): TripJsonEvent => ({
      ref: event.ref!,
      stopRef: text(event.stopRef),
      kind: event.kind!,
      title: event.title!,
      status: event.status ?? 'to_book',
      startsLocal: text(event.startsLocal),
      startTz: text(event.startTz),
      endsLocal: text(event.endsLocal),
      endTz: text(event.endTz),
      placeName: text(event.placeName),
      address: text(event.address),
      addressLocal: text(event.addressLocal),
      lat: event.lat ?? null,
      lng: event.lng ?? null,
      providerName: text(event.providerName),
      bookingCode: text(event.bookingCode),
      costMinor: event.costMinor ?? null,
      costCurrency: event.costCurrency?.toUpperCase() ?? null,
      notes: text(event.notes),
      leaveBufferMin: event.leaveBufferMin ?? null,
      travelMin: event.travelMin ?? null,
      coversNight: event.coversNight ?? null,
      segments: list(event.segments).map(segment),
    })),
    budgetCategories: list(raw.budgetCategories).map(
      (category: Loose<TripJsonBudgetCategory>, index): TripJsonBudgetCategory => ({
        ref: category.ref!,
        key: text(category.key),
        name: text(category.name),
        budgetMinor: category.budgetMinor ?? null,
        position: category.position ?? index,
      })
    ),
    expenses: list(raw.expenses).map((expense: Loose<TripJsonExpense>): TripJsonExpense => ({
      eventRef: text(expense.eventRef),
      categoryRef: text(expense.categoryRef),
      amountMinor: expense.amountMinor!,
      currency: expense.currency!.toUpperCase(),
      fxRate: text(expense.fxRate),
      fxRateDate: text(expense.fxRateDate),
      fxSource: expense.fxSource ?? null,
      baseAmountMinor: expense.baseAmountMinor ?? null,
      spentOn: expense.spentOn!,
      description: text(expense.description),
      paidByTravellerRef: text(expense.paidByTravellerRef),
      needsDetails: expense.needsDetails ?? false,
      shares: list(expense.shares),
    })),
    tasks: list(raw.tasks).map((task: Loose<TripJsonTask>): TripJsonTask => ({
      eventRef: text(task.eventRef),
      title: task.title!,
      titleKey: text(task.titleKey),
      notes: text(task.notes),
      dueOn: text(task.dueOn),
      priority: task.priority ?? 'normal',
      doneAt: text(task.doneAt),
      origin: task.origin ?? 'manual',
      sourceDocumentRef: text(task.sourceDocumentRef),
      templateItemKey: text(task.templateItemKey),
    })),
    documents: list(raw.documents).map((document: Loose<TripJsonDocument>): TripJsonDocument => ({
      ref: document.ref!,
      eventRef: text(document.eventRef),
      kind: document.kind!,
      title: document.title!,
      url: text(document.url),
      tags: list(document.tags),
      availableOffline: document.availableOffline ?? false,
      storageKey: text(document.storageKey),
      mime: text(document.mime),
      sizeBytes: document.sizeBytes ?? null,
      sha256: text(document.sha256),
      downloadUrl: text(document.downloadUrl),
    })),
    emergency: raw.emergency ?? null,
    phraseCards: list(raw.phraseCards).map((cards) => ({
      language: cards.language,
      cards: list(cards.cards),
      model: text(cards.model),
    })),
    notes: text(raw.notes),
  }
}
