import { test } from '@japa/runner'
import { readFile, rm } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import i18nManager from '@adonisjs/i18n/services/main'
import type { ApiClient } from '@japa/api-client'
import {
  nightCoverage,
  type TripContentSnapshot,
  type TripEvent,
  type TripImportResult,
  type TripJsonDocument,
  type TripJsonExpense,
  type TripJsonTask,
  type TripJsonV1,
} from '@monkitrips/shared'
import Trip from '#models/trip'
import type User from '#models/user'
import { DemoTrip } from '#services/demo_trip'
import { validateTripJson } from '#services/trip_json_schema'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pushApplied } from '#tests/helpers/sync'

async function fixture(): Promise<TripJsonV1> {
  return JSON.parse(
    await readFile(app.makePath('tests/fixtures/trip-json-v1/demo-loop.json'), 'utf8')
  )
}

async function exportTrip(client: ApiClient, user: User, tripId: string): Promise<TripJsonV1> {
  const response = await actingAs(client.get(`/api/v1/trips/${tripId}/export`), user)
  response.assertStatus(200)
  return response.body()
}

async function importTrip(
  client: ApiClient,
  user: User,
  document: unknown,
  dryRun = false
): Promise<TripImportResult> {
  const response = await actingAs(client.post(`/api/v1/trips/import?dryRun=${dryRun}`), user).json(
    document
  )
  if (response.status() !== (dryRun ? 200 : 201)) {
    throw new Error(`import answered ${response.status()}: ${JSON.stringify(response.body())}`)
  }
  return response.body().data
}

/**
 * The document with refs replaced by the names they point at and every list
 * in a stable order, so two exports of "the same" trip compare equal
 * whatever ids and refs each installation handed out. Files are compared
 * apart (an import turns them into links); the first traveller is "me".
 */
function canonical(document: TripJsonV1) {
  const traveller = (ref: string | null) =>
    ref === null
      ? null
      : document.travellers[0].ref === ref
        ? 'me'
        : document.travellers.find((t) => t.ref === ref)!.displayName
  const stop = (ref: string | null) =>
    ref === null ? null : document.stops.find((s) => s.ref === ref)!.name
  const event = (ref: string | null) =>
    ref === null ? null : document.events.find((e) => e.ref === ref)!.title
  const documentTitle = (ref: string | null) =>
    ref === null ? null : document.documents.find((d) => d.ref === ref)!.title
  const category = (ref: string | null) => {
    if (ref === null) return null
    const row = document.budgetCategories.find((c) => c.ref === ref)!
    return row.key ?? row.name
  }
  const byKey = <T>(rows: T[], key: (row: T) => string) =>
    [...rows].sort((a, b) => key(a).localeCompare(key(b)))
  return {
    trip: document.trip,
    travellers: document.travellers.map((t, index) => ({
      displayName: index === 0 ? 'me' : t.displayName,
      position: t.position,
    })),
    stops: document.stops.map(({ ref: _ref, ...rest }) => rest),
    events: byKey(document.events, (e) => `${e.startsLocal}|${e.title}`).map(
      ({ ref: _ref, stopRef: stopRefOf, segments, ...rest }) => ({
        ...rest,
        stop: stop(stopRefOf),
        segments: byKey(segments, (leg) => String(leg.position)).map(
          ({ ref: _legRef, seats, ...leg }) => ({
            ...leg,
            seats: byKey(seats, (seat) => traveller(seat.travellerRef)!).map((seat) => ({
              ...seat,
              travellerRef: traveller(seat.travellerRef),
              documentRef: documentTitle(seat.documentRef),
            })),
          })
        ),
      })
    ),
    budgetCategories: document.budgetCategories.map(({ ref: _ref, ...rest }) => rest),
    expenses: byKey(document.expenses, (x) => `${x.spentOn}|${x.description}`).map(
      (x): Omit<TripJsonExpense, 'shares'> & { shares: unknown[] } => ({
        ...x,
        eventRef: event(x.eventRef),
        categoryRef: category(x.categoryRef),
        paidByTravellerRef: traveller(x.paidByTravellerRef),
        shares: byKey(x.shares, (share) => traveller(share.travellerRef)!).map((share) => ({
          travellerRef: traveller(share.travellerRef),
          shareMinor: share.shareMinor,
        })),
      })
    ),
    tasks: byKey(document.tasks, (t) => t.title).map((t): TripJsonTask => ({
      ...t,
      eventRef: event(t.eventRef),
      sourceDocumentRef: documentTitle(t.sourceDocumentRef),
    })),
    documents: byKey(document.documents, (d) => d.title).map(
      (d): Pick<TripJsonDocument, 'title' | 'tags' | 'availableOffline' | 'eventRef'> => ({
        title: d.title,
        tags: d.tags,
        availableOffline: d.availableOffline,
        eventRef: event(d.eventRef),
      })
    ),
    emergency: document.emergency,
    phraseCards: document.phraseCards,
  }
}

/** The events of a snapshot as the shared night rule reads them (instant plus the zone's offset). */
function nightEvents(snapshot: TripContentSnapshot): TripEvent[] {
  const zoned = (at: string | null, tz: string | null) =>
    at && tz ? { at, offsetMin: DateTime.fromISO(at, { zone: tz }).offset, tz } : null
  return snapshot.events.flatMap((row) => {
    const starts = zoned(row.startsAt, row.startTz)
    if (!starts) return []
    return [
      {
        id: row.id,
        kind: row.kind,
        status: row.status,
        title: row.title,
        starts,
        ends: zoned(row.endsAt, row.endTz ?? row.startTz),
        coversNight: row.coversNight,
      },
    ]
  })
}

test.group('Trip JSON v1', (group) => {
  useFixedClock(group, new Date('2026-11-07T10:00:00Z'))
  group.teardown(() => rm(app.tmpPath('drive'), { recursive: true, force: true }))

  test('export answers the document as a named attachment that passes the schema', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser({ displayName: 'Owner' })
    const partner = await makeUser({ displayName: 'Partner' })
    const demo = await app.container.make(DemoTrip)
    const { tripId } = await demo.seed({ ownerEmail: owner.email, partnerEmail: partner.email })

    const response = await actingAs(client.get(`/api/v1/trips/${tripId}/export`), partner)

    response.assertStatus(200)
    assert.equal(
      response.header('content-disposition'),
      'attachment; filename="trip-demo-loop-2026-11-07.json"'
    )
    const document: TripJsonV1 = response.body()
    assert.equal(document.version, 'trip-json-v1')
    assert.notProperty(document, 'data')
    assert.deepEqual(validateTripJson(document, i18nManager.locale('en')), [])
    assert.lengthOf(document.events, 8)
    assert.lengthOf(document.events[0].segments, 2)
    assert.lengthOf(document.events[0].segments[0].seats, 3)
    const voucher = document.documents.find((d) => d.kind === 'file')!
    assert.match(voucher.storageKey!, new RegExp(`^trips/${tripId}/`))
    assert.match(voucher.downloadUrl!, /^http:\/\/127\.0\.0\.1:3333\/drive\/fs\/.+signature=/)
    assert.isTrue(document.expenses.some((x) => x.fxRate === null && x.needsDetails))
    const text = JSON.stringify(document)
    assert.notInclude(text, owner.id)
    assert.notInclude(text, partner.id)
  })

  test('trip json v1 round trips through export and import', async ({ client, assert }) => {
    const owner = await makeUser({ displayName: 'Owner' })
    const partner = await makeUser({ displayName: 'Partner' })
    const importer = await makeUser({ displayName: 'Someone else' })
    const demo = await app.container.make(DemoTrip)
    const { tripId } = await demo.seed({ ownerEmail: owner.email, partnerEmail: partner.email })
    const exported = await exportTrip(client, owner, tripId)

    const result = await importTrip(client, importer, exported)
    const reexported = await exportTrip(client, importer, result.tripId!)

    assert.deepEqual(canonical(reexported), canonical(exported))
    assert.deepEqual(validateTripJson(reexported, i18nManager.locale('en')), [])
    // The voucher came over as a link to the download address of the original.
    const original = exported.documents.find((d) => d.kind === 'file')!
    const copy = reexported.documents.find((d) => d.title === original.title)!
    assert.include(copy, { kind: 'link', url: original.downloadUrl, storageKey: null })
    assert.deepEqual(reexported.members, [{ role: 'owner', displayName: 'Someone else' }])
    assert.equal(reexported.travellers[0].displayName, 'Someone else')
    assert.deepEqual(
      result.summary.warnings.map((w) => [w.code, w.count]),
      [
        ['callerIsFirstTraveller', 1],
        ['membersNotImported', 1],
        ['fileDocumentAsLink', 1],
      ]
    )
  })

  test('dry run writes nothing', async ({ client, assert }) => {
    const user = await makeUser()
    const before = await db.from('trips').count('* as count').first()

    const result = await importTrip(client, user, await fixture(), true)

    assert.isNull(result.tripId)
    assert.isTrue(result.dryRun)
    assert.deepEqual(result.summary.trip, {
      name: 'Demo Loop',
      startsOn: '2027-01-20',
      endsOn: '2027-02-06',
    })
    assert.deepEqual(result.summary.counts, {
      stops: 3,
      events: 4,
      segments: 2,
      seats: 3,
      expenses: 3,
      tasks: 3,
      documents: 2,
    })
    assert.isTrue(result.summary.warnings.some((w) => w.code === 'fileDocumentAsLink'))
    const after = await db.from('trips').count('* as count').first()
    assert.equal(after!.count, before!.count)
    assert.isEmpty(await db.from('trip_members').where('user_id', user.id))
    assert.isEmpty(await db.from('sync_mutations').where('user_id', user.id))
    assert.isEmpty(await db.from('trip_activity').where('actor_user_id', user.id))
  })

  test('import creates a new trip owned by the caller', async ({
    client,
    assert,
    db: dbAssert,
  }) => {
    const user = await makeUser({ displayName: 'Importer' })

    const result = await importTrip(client, user, await fixture())

    const trip = await Trip.findOrFail(result.tripId!)
    assert.equal(trip.name, 'Demo Loop')
    assert.equal(trip.createdBy, user.id)
    await dbAssert.assertHas('trip_members', { trip_id: trip.id, user_id: user.id, role: 'owner' })
    const travellers = await db.from('travellers').where('trip_id', trip.id).orderBy('position')
    assert.deepEqual(
      travellers.map((t) => [t.display_name, t.user_id, t.position]),
      [
        ['Importer', user.id, 0],
        ['Partner', null, 1],
        ['Friend without the app', null, 2],
      ]
    )
    // The split and the seats point at the caller's own traveller row.
    const [dinner] = await db
      .from('expenses')
      .where('trip_id', trip.id)
      .where('amount_minor', 45000)
    assert.equal(dinner.paid_by_traveller_id, travellers[0].id)
    const shares = await db.from('expense_shares').where('expense_id', dinner.id)
    assert.sameMembers(
      shares.map((s) => s.traveller_id),
      [travellers[0].id, travellers[1].id]
    )
    assert.lengthOf(await db.from('segment_seats').where('trip_id', trip.id), 3)
    // Default categories were updated, not duplicated; the custom one was added.
    const categories = await db
      .from('budget_categories')
      .where('trip_id', trip.id)
      .whereNull('deleted_at')
      .orderBy('position')
    assert.lengthOf(categories, 7)
    assert.equal(categories[0].key, 'accommodation')
    assert.equal(Number(categories[0].budget_minor), 500000)
    assert.equal(categories[6].name, 'Souvenirs')
    // The print tag made its task again, done as the file recorded; other tasks are manual.
    const tasks = await db.from('tasks').where('trip_id', trip.id).whereNull('deleted_at')
    const printTask = tasks.find((t) => t.origin === 'document')!
    assert.equal(printTask.title_key, 'print_document')
    assert.equal(printTask.done_at?.toISOString(), '2026-11-05T09:00:00.000Z')
    assert.lengthOf(tasks, 3)
    // Every row went through the sync engine: activity and replay records exist.
    const activity = await db.from('trip_activity').where('trip_id', trip.id)
    const mutations = await db.from('sync_mutations').where('trip_id', trip.id)
    assert.isAbove(activity.length, 10)
    assert.isAbove(mutations.length, 10)
    assert.equal(result.summary.counts.documents, 2)
  })

  test('unresolved ref answers 422 and writes nothing', async ({ client, assert }) => {
    const user = await makeUser()
    const document = await fixture()
    document.events[1].stopRef = 'stop-9'

    const response = await actingAs(client.post('/api/v1/trips/import'), user).json(document)

    response.assertStatus(422)
    assert.deepEqual(
      response.body().errors.map((e: { field: string; rule: string }) => [e.field, e.rule]),
      [['events[1].stopRef', 'unresolvedRef']]
    )
    assert.isEmpty(await db.from('trips').where('created_by', user.id))
    assert.isEmpty(await db.from('sync_mutations').where('user_id', user.id))
  })

  test('a row the entity validators refuse answers 422 with its path and writes nothing', async ({
    client,
    assert,
  }) => {
    const user = await makeUser()
    const document = await fixture()
    // A local time inside a daylight-saving gap does not exist.
    document.events[3].startsLocal = '2026-03-08T02:30:00'
    document.events[3].startTz = 'America/New_York'

    const response = await actingAs(client.post('/api/v1/trips/import'), user).json(document)

    response.assertStatus(422)
    assert.deepEqual(
      response.body().errors.map((e: { field: string; rule: string }) => [e.field, e.rule]),
      [['events[3].startsLocal', 'nonexistentLocalTime']]
    )
    assert.isEmpty(await db.from('trips').where('created_by', user.id))
  })

  test('a file that is not a trip json v1 document answers 422 per field', async ({
    client,
    assert,
  }) => {
    const user = await makeUser()

    const response = await actingAs(client.post('/api/v1/trips/import'), user).json({
      version: 'trip-json-v1',
      trip: {
        name: 'x'.repeat(121),
        baseCurrency: 'AUD',
        startsOn: '2027-02-06',
        endsOn: '2027-01-20',
      },
    })

    response.assertStatus(422)
    assert.deepEqual(
      response.body().errors.map((e: { field: string; rule: string }) => [e.field, e.rule]),
      [['trip.name', 'maxLength']]
    )
    const dates = await actingAs(client.post('/api/v1/trips/import'), user).json({
      version: 'trip-json-v1',
      trip: {
        name: 'Backwards',
        baseCurrency: 'AUD',
        startsOn: '2027-02-06',
        endsOn: '2027-01-20',
      },
    })
    dates.assertStatus(422)
    dates.assertBodyContains({ errors: [{ field: 'trip.endsOn', rule: 'afterOrEqual' }] })
  })

  test('import above the size limit answers 413', async ({ client, assert }) => {
    const user = await makeUser()
    const document = await fixture()
    document.notes = 'x'.repeat(2 * 1024 * 1024)

    const response = await actingAs(client.post('/api/v1/trips/import'), user).json(document)

    response.assertStatus(413)
    response.assertBodyContains({ code: 'E_FILE_TOO_LARGE' })
    assert.isEmpty(await db.from('trips').where('created_by', user.id))
  })

  test("export of another member's trip answers 404", async ({ client }) => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/export`), stranger)

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
  })

  test('imported overnight train covers its night', async ({ client, assert }) => {
    const user = await makeUser()
    const result = await importTrip(client, user, await fixture())

    const nights = await actingAs(client.get(`/api/v1/trips/${result.tripId}/nights`), user)
    nights.assertStatus(200)
    const view = nights.body().data
    const trainNight = view.nights.find((n: { date: string }) => n.date === '2027-01-27')
    assert.equal(trainNight.coveredBy.kind, 'train')
    assert.isFalse(view.nights.find((n: { date: string }) => n.date === '2027-01-26').covered)

    // The shared rule, run over the imported rows, agrees with the view.
    const snapshot = await actingAs(client.get(`/api/v1/trips/${result.tripId}/snapshot`), user)
    const report = nightCoverage(
      { startsOn: '2027-01-20', endsOn: '2027-02-06' },
      nightEvents(snapshot.body().data)
    )
    const night = report.nights.find((n) => n.date === '2027-01-27')!
    assert.deepEqual(
      night.coveredBy.map((c) => [c.kind, c.how]),
      [['train', 'transport']]
    )
    assert.include(report.uncovered, '2027-01-26')
  })

  test('imported expenses keep their stored rate and base amount', async ({ client, assert }) => {
    const user = await makeUser()
    const result = await importTrip(client, user, await fixture())

    const expenses = await db.from('expenses').where('trip_id', result.tripId!).orderBy('spent_on')
    assert.deepEqual(
      expenses.map((x) => [x.currency, x.fx_rate, x.fx_source, x.base_amount_minor]),
      [
        ['THB', '22.5000000000', 'manual', '2000'],
        ['VND', null, null, null],
        ['JPY', '95.0000000000', 'manual', '2000'],
      ]
    )
    assert.equal(expenses[1].fx_rate_date, null)
    assert.equal(DateTime.fromJSDate(expenses[0].fx_rate_date).toISODate(), '2027-01-21')
  })

  test('me export includes every trip', async ({ client, assert }) => {
    const user = await makeUser({ displayName: 'Owner' })
    const partner = await makeUser({ displayName: 'Partner' })
    const owned = await makeTrip(user, { name: 'Owned' })
    const shared = await makeTrip(partner, { name: 'Shared' })
    await addMember(shared, user)
    await pushApplied(client, user, mutation(owned.id, 'stop', { name: 'Harbour Town' }))

    const response = await actingAs(client.get('/api/v1/me/export'), user)

    response.assertStatus(200)
    const trips: TripJsonV1[] = response.body().data.trips
    assert.sameMembers(
      trips.map((t) => t.trip.name),
      ['Owned', 'Shared']
    )
    for (const trip of trips) {
      assert.equal(trip.version, 'trip-json-v1')
      assert.deepEqual(validateTripJson(trip, i18nManager.locale('en')), [])
    }
    assert.deepEqual(
      trips.find((t) => t.trip.name === 'Owned')!.stops.map((s) => s.name),
      ['Harbour Town']
    )
  })

  test('the schema is public and cacheable', async ({ client, assert }) => {
    const response = await client.get('/api/v1/schemas/trip-json-v1')

    response.assertStatus(200)
    assert.equal(response.body().title, 'trip JSON v1')
    assert.equal(response.header('cache-control'), 'public, max-age=3600')
  })
})
