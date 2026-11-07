import {
  TRIP_JSON_SCHEMA_VERSION,
  TRIP_JSON_VERSION,
  type EmergencyInfoContent,
  type TripContentSnapshot,
  type TripJsonBudgetCategory,
  type TripJsonDocument,
  type TripJsonEvent,
  type TripJsonExpense,
  type TripJsonSegment,
  type TripJsonTask,
  type TripJsonV1,
} from '@monkitrips/shared'

/** What the exporter adds to the snapshot: where the bytes of each file document are. */
export interface ExportedFile {
  storageKey: string | null
  /** A signed link valid for a few minutes, or null when the store could not sign one. */
  downloadUrl: string | null
}

export interface TripExportInput {
  snapshot: TripContentSnapshot
  /** By document id, for `kind: file` documents. */
  files: ReadonlyMap<string, ExportedFile>
  exportedAt: Date
}

/** Readable refs: `<entity>-<n>` in the snapshot's order, so a hand edit can follow them. */
function refsOf<T extends { id: string }>(rows: readonly T[], prefix: string): Map<string, string> {
  return new Map(rows.map((row, index) => [row.id, `${prefix}-${index + 1}`]))
}

/**
 * Builds the portable trip document from a snapshot. Database ids become
 * `ref`s; account ids never leave (members keep role and display name,
 * travellers drop their `userId`). `exportedAt` is a parameter so the output
 * is reproducible.
 */
export function buildTripJsonV1(input: TripExportInput): TripJsonV1 {
  const { snapshot } = input
  const { name, baseCurrency, budgetMode, budgetTotalMinor, startsOn, endsOn, homeTz } =
    snapshot.trip

  const travellerRefs = refsOf(snapshot.travellers, 'traveller')
  const stopRefs = refsOf(snapshot.stops, 'stop')
  const eventRefs = refsOf(snapshot.events, 'event')
  const segmentRefs = refsOf(snapshot.segments, 'segment')
  const documentRefs = refsOf(snapshot.documents, 'document')
  const categoryRefs = new Map(
    snapshot.budgetCategories.map((category, index) => [
      category.id,
      category.key ? `category-${category.key}` : `category-${index + 1}`,
    ])
  )
  const ref = (refs: Map<string, string>, id: string | null | undefined): string | null =>
    id ? (refs.get(id) ?? null) : null

  const segmentsByEvent = new Map<string, TripJsonSegment[]>()
  for (const segment of snapshot.segments) {
    const seats = snapshot.seats
      .filter((seat) => seat.segmentId === segment.id)
      .flatMap((seat) => {
        const travellerRef = ref(travellerRefs, seat.travellerId)
        if (!travellerRef) return []
        return [
          {
            travellerRef,
            seat: seat.seat,
            coach: seat.coach,
            ticketNumber: seat.ticketNumber,
            documentRef: ref(documentRefs, seat.documentId),
          },
        ]
      })
    const list = segmentsByEvent.get(segment.eventId) ?? []
    list.push({
      ref: segmentRefs.get(segment.id)!,
      position: segment.position,
      carrier: segment.carrier ?? null,
      number: segment.number ?? null,
      originName: segment.originName ?? null,
      originCode: segment.originCode ?? null,
      originLat: segment.originLat,
      originLng: segment.originLng,
      destName: segment.destName ?? null,
      destCode: segment.destCode ?? null,
      destLat: segment.destLat,
      destLng: segment.destLng,
      departsLocal: segment.departsLocal,
      departsTz: segment.departsTz,
      arrivesLocal: segment.arrivesLocal,
      arrivesTz: segment.arrivesTz,
      seats,
    })
    segmentsByEvent.set(segment.eventId, list)
  }

  const events: TripJsonEvent[] = snapshot.events.map((event) => ({
    ref: eventRefs.get(event.id)!,
    stopRef: ref(stopRefs, event.stopId),
    kind: event.kind,
    title: event.title,
    status: event.status,
    startsLocal: event.startsLocal,
    startTz: event.startTz,
    endsLocal: event.endsLocal,
    endTz: event.endTz,
    placeName: event.placeName ?? null,
    address: event.address ?? null,
    addressLocal: event.addressLocal ?? null,
    lat: event.lat,
    lng: event.lng,
    providerName: event.providerName,
    bookingCode: event.bookingCode,
    costMinor: event.costMinor,
    costCurrency: event.costCurrency ?? null,
    notes: event.notes,
    leaveBufferMin: event.leaveBufferMin ?? null,
    travelMin: event.travelMin ?? null,
    coversNight: event.coversNight ?? null,
    segments: segmentsByEvent.get(event.id) ?? [],
  }))

  const budgetCategories: TripJsonBudgetCategory[] = snapshot.budgetCategories.map((category) => ({
    ref: categoryRefs.get(category.id)!,
    key: category.key,
    name: category.name,
    budgetMinor: category.budgetMinor,
    position: category.position,
  }))

  const expenses: TripJsonExpense[] = snapshot.expenses.map((expense) => ({
    eventRef: ref(eventRefs, expense.eventId),
    categoryRef: ref(categoryRefs, expense.categoryId),
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    fxRate: expense.fxRate,
    fxRateDate: expense.fxRateDate,
    fxSource: expense.fxSource,
    baseAmountMinor: expense.baseAmountMinor,
    spentOn: expense.spentOn,
    description: expense.description,
    paidByTravellerRef: ref(travellerRefs, expense.paidByTravellerId),
    needsDetails: expense.needsDetails,
    shares: snapshot.expenseShares
      .filter((share) => share.expenseId === expense.id)
      .flatMap((share) => {
        const travellerRef = ref(travellerRefs, share.travellerId)
        return travellerRef ? [{ travellerRef, shareMinor: share.shareMinor }] : []
      }),
  }))

  const tasks: TripJsonTask[] = snapshot.tasks.map((task) => ({
    eventRef: ref(eventRefs, task.eventId),
    title: task.title,
    titleKey: task.titleKey ?? null,
    notes: task.notes,
    dueOn: task.dueOn,
    priority: task.priority,
    doneAt: task.doneAt,
    origin: task.origin,
    sourceDocumentRef: ref(documentRefs, task.sourceDocumentId),
    templateItemKey: task.templateItemKey,
  }))

  const documents: TripJsonDocument[] = snapshot.documents.map((document) => {
    const file = document.kind === 'file' ? input.files.get(document.id) : undefined
    return {
      ref: documentRefs.get(document.id)!,
      eventRef: ref(eventRefs, document.eventId),
      kind: document.kind,
      title: document.title,
      url: document.url,
      tags: [...document.tags],
      availableOffline: document.availableOffline,
      storageKey: file?.storageKey ?? null,
      mime: document.mime,
      sizeBytes: document.sizeBytes,
      sha256: document.sha256,
      downloadUrl: file?.downloadUrl ?? null,
    }
  })

  const emergency: EmergencyInfoContent | null = snapshot.emergency
    ? snapshot.emergency.content
    : null

  return {
    version: TRIP_JSON_VERSION,
    schemaVersion: TRIP_JSON_SCHEMA_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    trip: { name, baseCurrency, budgetMode, budgetTotalMinor, startsOn, endsOn, homeTz },
    members: snapshot.members.map(({ role, displayName }) => ({ role, displayName })),
    travellers: snapshot.travellers.map((traveller) => ({
      ref: travellerRefs.get(traveller.id)!,
      displayName: traveller.displayName,
      position: traveller.position,
    })),
    stops: snapshot.stops.map((stop) => ({
      ref: stopRefs.get(stop.id)!,
      position: stop.position,
      name: stop.name,
      countryCode: stop.countryCode,
      lat: stop.lat,
      lng: stop.lng,
      tz: stop.tz,
      arriveOn: stop.arriveOn,
      departOn: stop.departOn,
    })),
    events,
    budgetCategories,
    expenses,
    tasks,
    documents,
    emergency,
    phraseCards: snapshot.phraseCards.map((cards) => ({
      language: cards.language,
      cards: cards.cards,
      model: cards.model,
    })),
    notes: null,
  }
}
