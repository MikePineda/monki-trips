import {
  DEFAULT_BUDGET_CATEGORY_KEYS,
  EMERGENCY_INFO_KEYS,
  type SyncMutation,
  type SyncPushEntity,
  type TripImportCounts,
  type TripImportWarningCode,
  type TripJsonV1,
} from '@monkitrips/shared'
import { uuidV5 } from '#domain/uuid_v5'

/** A problem with the file the schema could not see: a ref that names nothing, or two rows with one ref. */
export interface RefProblem {
  /** Path inside the file, `events[2].stopRef`. */
  field: string
  rule: 'unresolvedRef' | 'duplicateRef'
}

/** One mutation of the plan with the file path it came from, for error messages. */
export interface PlannedMutation {
  path: string
  mutation: SyncMutation
}

export interface TripImportPlan {
  /** In application order: parents before children. */
  mutations: PlannedMutation[]
  /** Done states to replay on the print tasks the document side effects create. */
  printTasksDone: { documentId: string; doneAt: string }[]
  counts: TripImportCounts
  warnings: { code: TripImportWarningCode; count: number }[]
}

export type TripImportPlanResult =
  { ok: true; plan: TripImportPlan } | { ok: false; problems: RefProblem[] }

export interface TripImportPlanInput {
  document: TripJsonV1
  /** The fresh UUID every id of this import derives from. */
  importId: string
  /** The trip the import creates. */
  tripId: string
  /** The caller's traveller row in the new trip: the file's first traveller becomes it. */
  callerTravellerId: string
  /** The new trip's default budget categories, matched by `key`. */
  defaultCategories: readonly { id: string; key: string | null }[]
  /** The instant of the import, `changedAt` of every mutation. */
  changedAt: string
}

/**
 * Turns a trip JSON v1 document into the sync mutations that rebuild it in a
 * new trip, resolving every `ref` to an id derived from the import's UUID.
 * Pure: the caller creates the trip and applies the mutations through the
 * sync engine, so the import gets the same validation, derived values and
 * activity rows as any client write.
 */
export function planTripImport(input: TripImportPlanInput): TripImportPlanResult {
  const { document, importId, tripId, changedAt } = input
  const problems: RefProblem[] = []
  const warnings = new Map<TripImportWarningCode, number>()
  const warn = (code: TripImportWarningCode, count = 1) =>
    warnings.set(code, (warnings.get(code) ?? 0) + count)
  const idOf = (key: string) => uuidV5(importId, key)
  const mutations: PlannedMutation[] = []
  const push = (
    path: string,
    entity: SyncPushEntity,
    id: string,
    changes: Record<string, unknown>
  ) => {
    mutations.push({
      path,
      mutation: {
        mutationId: idOf(`mutation:${entity}:${id}`),
        tripId,
        entity,
        op: 'upsert',
        id,
        changes,
        changedAt,
      },
    })
  }

  /** Ref -> id of one entity, reporting duplicates; the table is what later refs resolve against. */
  function table(rows: readonly { ref: string }[], entity: string, path: string) {
    const ids = new Map<string, string>()
    rows.forEach((row, index) => {
      if (ids.has(row.ref)) problems.push({ field: `${path}[${index}].ref`, rule: 'duplicateRef' })
      ids.set(row.ref, idOf(`${entity}:${row.ref}`))
    })
    return ids
  }
  function resolve(ids: Map<string, string>, ref: string | null, field: string): string | null {
    if (ref === null) return null
    const id = ids.get(ref)
    if (!id) problems.push({ field, rule: 'unresolvedRef' })
    return id ?? null
  }

  // People: the first traveller is the caller.
  const travellerIds = table(document.travellers, 'traveller', 'travellers')
  document.travellers.forEach((traveller, index) => {
    const path = `travellers[${index}]`
    if (index === 0) {
      travellerIds.set(traveller.ref, input.callerTravellerId)
      warn('callerIsFirstTraveller')
      push(path, 'traveller', input.callerTravellerId, { position: traveller.position })
      return
    }
    push(path, 'traveller', travellerIds.get(traveller.ref)!, {
      displayName: traveller.displayName,
      position: traveller.position,
    })
  })
  if (document.members.length > 1) warn('membersNotImported', document.members.length - 1)

  const stopIds = table(document.stops, 'stop', 'stops')
  document.stops.forEach((stop, index) => {
    const { ref, ...changes } = stop
    push(`stops[${index}]`, 'stop', stopIds.get(ref)!, changes)
  })

  // Events, then their legs: a leg points at its event.
  const eventIds = table(document.events, 'event', 'events')
  const segments = document.events.flatMap((event, eventIndex) =>
    event.segments.map((segment, index) => ({
      segment,
      eventRef: event.ref,
      path: `events[${eventIndex}].segments[${index}]`,
    }))
  )
  const segmentIds = table(
    segments.map(({ segment }) => segment),
    'segment',
    'segments'
  )
  document.events.forEach((event, index) => {
    const path = `events[${index}]`
    push(path, 'event', eventIds.get(event.ref)!, {
      kind: event.kind,
      title: event.title,
      status: event.status,
      startsLocal: event.startsLocal,
      startTz: event.startTz,
      endsLocal: event.endsLocal,
      endTz: event.endTz,
      placeName: event.placeName,
      address: event.address,
      addressLocal: event.addressLocal,
      lat: event.lat,
      lng: event.lng,
      providerName: event.providerName,
      bookingCode: event.bookingCode,
      costMinor: event.costMinor,
      costCurrency: event.costCurrency,
      notes: event.notes,
      leaveBufferMin: event.leaveBufferMin,
      travelMin: event.travelMin,
      coversNight: event.coversNight,
      stopId: resolve(stopIds, event.stopRef, `${path}.stopRef`),
    })
  })
  for (const { segment, eventRef, path } of segments) {
    push(path, 'segment', segmentIds.get(segment.ref)!, {
      eventId: eventIds.get(eventRef)!,
      position: segment.position,
      carrier: segment.carrier,
      number: segment.number,
      originName: segment.originName,
      originCode: segment.originCode,
      originLat: segment.originLat,
      originLng: segment.originLng,
      destName: segment.destName,
      destCode: segment.destCode,
      destLat: segment.destLat,
      destLng: segment.destLng,
      departsLocal: segment.departsLocal,
      departsTz: segment.departsTz,
      arrivesLocal: segment.arrivesLocal,
      arrivesTz: segment.arrivesTz,
    })
  }

  // Documents before seats (a seat may point at its ticket). Files cannot be
  // created through sync: one with a download link becomes a link document.
  const documentIds = table(document.documents, 'document', 'documents')
  const skippedDocumentRefs = new Set<string>()
  document.documents.forEach((row, index) => {
    const path = `documents[${index}]`
    const id = documentIds.get(row.ref)!
    const base = {
      title: row.title,
      tags: row.tags,
      availableOffline: row.availableOffline,
      eventId: resolve(eventIds, row.eventRef, `${path}.eventRef`),
    }
    if (row.kind === 'link') {
      push(path, 'document', id, { ...base, kind: 'link', url: row.url })
      return
    }
    const url = row.downloadUrl ?? row.url
    if (url) {
      warn('fileDocumentAsLink')
      push(path, 'document', id, { ...base, kind: 'link', url })
    } else {
      warn('fileDocumentSkipped')
      documentIds.delete(row.ref)
      skippedDocumentRefs.add(row.ref)
    }
  })
  const importedDocuments = [...documentIds.keys()].length

  for (const { segment, path } of segments) {
    segment.seats.forEach((seat, index) => {
      const seatPath = `${path}.seats[${index}]`
      const travellerId = resolve(travellerIds, seat.travellerRef, `${seatPath}.travellerRef`)
      push(seatPath, 'seat', idOf(`seat:${segment.ref}:${seat.travellerRef}`), {
        segmentId: segmentIds.get(segment.ref)!,
        travellerId,
        seat: seat.seat,
        coach: seat.coach,
        ticketNumber: seat.ticketNumber,
        // A ticket the import could not carry over leaves the seat without one.
        documentId:
          seat.documentRef && documentIds.has(seat.documentRef)
            ? documentIds.get(seat.documentRef)!
            : null,
      })
    })
  }

  // Budget lines: a default key updates the new trip's own row, anything else is a new row.
  const categoryIds = table(document.budgetCategories, 'budget_category', 'budgetCategories')
  const defaults = new Map(
    input.defaultCategories.flatMap((row) => (row.key ? [[row.key, row.id] as const] : []))
  )
  document.budgetCategories.forEach((category, index) => {
    const path = `budgetCategories[${index}]`
    const existing = category.key ? defaults.get(category.key) : undefined
    if (existing) {
      categoryIds.set(category.ref, existing)
      push(path, 'budget_category', existing, {
        budgetMinor: category.budgetMinor,
        position: category.position,
        ...(category.name !== null ? { name: category.name } : {}),
      })
      return
    }
    push(path, 'budget_category', categoryIds.get(category.ref)!, {
      key: category.key,
      name: category.name,
      budgetMinor: category.budgetMinor,
      position: category.position,
    })
  })
  // A file without categories keeps the defaults; one that lists only some keeps the rest too.
  for (const key of DEFAULT_BUDGET_CATEGORY_KEYS) {
    const id = defaults.get(key)
    if (id && !categoryIds.has(`category-${key}`)) categoryIds.set(`category-${key}`, id)
  }

  document.expenses.forEach((expense, index) => {
    const path = `expenses[${index}]`
    const { eventRef, categoryRef, paidByTravellerRef, shares } = expense
    // `baseAmountMinor` is derived from the rate on the way in, never taken from the file.
    push(path, 'expense', idOf(`expense:${index}`), {
      kind: expense.kind ?? 'expense',
      amountMinor: expense.amountMinor,
      currency: expense.currency,
      fxRate: expense.fxRate,
      fxRateDate: expense.fxRateDate,
      fxSource: expense.fxSource,
      spentOn: expense.spentOn,
      description: expense.description,
      needsDetails: expense.needsDetails,
      eventId: resolve(eventIds, eventRef, `${path}.eventRef`),
      categoryId: resolve(categoryIds, categoryRef, `${path}.categoryRef`),
      paidByTravellerId: resolve(travellerIds, paidByTravellerRef, `${path}.paidByTravellerRef`),
      ...(shares.length > 0
        ? {
            shares: shares.map((share, shareIndex) => ({
              id: idOf(`expense_share:${index}:${share.travellerRef}`),
              travellerId: resolve(
                travellerIds,
                share.travellerRef,
                `${path}.shares[${shareIndex}].travellerRef`
              ),
              shareMinor: share.shareMinor,
            })),
          }
        : {}),
    })
  })

  // Tasks: a print task is recreated by its document's tag (only its done
  // state is replayed); any other generated origin becomes a manual task.
  const printTasksDone: TripImportPlan['printTasksDone'] = []
  document.tasks.forEach((task, index) => {
    const path = `tasks[${index}]`
    if (task.origin === 'document' && task.sourceDocumentRef !== null) {
      // The task of a document that was left out goes with it.
      if (skippedDocumentRefs.has(task.sourceDocumentRef)) return
      const documentId = resolve(documentIds, task.sourceDocumentRef, `${path}.sourceDocumentRef`)
      if (documentId && task.doneAt) printTasksDone.push({ documentId, doneAt: task.doneAt })
      return
    }
    if (task.origin !== 'manual') warn('taskOriginReset')
    push(path, 'task', idOf(`task:${index}`), {
      title: task.title,
      notes: task.notes,
      dueOn: task.dueOn,
      priority: task.priority,
      doneAt: task.doneAt,
      eventId: resolve(eventIds, task.eventRef, `${path}.eventRef`),
    })
  })

  if (document.emergency) {
    const content: Record<string, unknown> = {}
    for (const key of EMERGENCY_INFO_KEYS) {
      if (document.emergency[key] !== undefined) content[key] = document.emergency[key]
    }
    push('emergency', 'emergency', tripId, content)
  }
  if (document.phraseCards.length > 0) warn('phraseCardsSkipped', document.phraseCards.length)

  if (problems.length > 0) return { ok: false, problems }
  return {
    ok: true,
    plan: {
      mutations,
      printTasksDone,
      counts: {
        stops: document.stops.length,
        events: document.events.length,
        segments: segments.length,
        seats: segments.reduce((total, { segment }) => total + segment.seats.length, 0),
        expenses: document.expenses.length,
        tasks: document.tasks.length,
        documents: importedDocuments,
      },
      warnings: [...warnings.entries()].map(([code, count]) => ({ code, count })),
    },
  }
}
