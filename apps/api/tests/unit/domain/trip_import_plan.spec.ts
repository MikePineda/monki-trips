import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import type { SyncMutation, TripJsonV1 } from '@monkitrips/shared'
import { planTripImport, type TripImportPlan } from '#domain/trip_import_plan'
import { withTripJsonDefaults } from '#domain/trip_json_defaults'
import { uuidV5 } from '#domain/uuid_v5'

const IMPORT_ID = '0192f0a0-7c3e-7d1a-9b4a-3c2e1d0f9a8b'
const TRIP_ID = '11111111-1111-4111-8111-111111111111'
const CALLER_TRAVELLER = '22222222-2222-4222-8222-222222222222'
const DEFAULT_CATEGORIES = [
  'accommodation',
  'transport',
  'food',
  'activities',
  'shopping',
  'other',
].map((key, index) => ({ id: `33333333-3333-4333-8333-33333333333${index}`, key }))

async function fixture(): Promise<TripJsonV1> {
  const raw = JSON.parse(
    await readFile(app.makePath('tests/fixtures/trip-json-v1/demo-loop.json'), 'utf8')
  )
  return withTripJsonDefaults(raw, { homeTz: 'UTC' })
}

function plan(document: TripJsonV1): TripImportPlan {
  const result = planTripImport({
    document,
    importId: IMPORT_ID,
    tripId: TRIP_ID,
    callerTravellerId: CALLER_TRAVELLER,
    defaultCategories: DEFAULT_CATEGORIES,
    changedAt: '2026-11-07T10:00:00.000Z',
  })
  if (!result.ok) throw new Error(JSON.stringify(result.problems))
  return result.plan
}

function mutationsOf(p: TripImportPlan, entity: SyncMutation['entity']): SyncMutation[] {
  return p.mutations.filter((m) => m.mutation.entity === entity).map((m) => m.mutation)
}

test.group('Trip import plan', () => {
  test('resolves every ref to an id derived from the import uuid, parents before children', async ({
    assert,
  }) => {
    const p = plan(await fixture())

    const order = p.mutations.map((m) => m.mutation.entity)
    const firstOf = (entity: SyncMutation['entity']) => order.indexOf(entity)
    assert.isBelow(firstOf('stop'), firstOf('event'))
    assert.isBelow(firstOf('event'), firstOf('segment'))
    assert.isBelow(firstOf('segment'), firstOf('seat'))
    assert.isBelow(firstOf('document'), firstOf('seat'))
    assert.isBelow(firstOf('budget_category'), firstOf('expense'))

    const [outbound] = mutationsOf(p, 'event')
    assert.equal(outbound.id, uuidV5(IMPORT_ID, 'event:event-1'))
    assert.equal(outbound.changes['stopId'], uuidV5(IMPORT_ID, 'stop:stop-1'))
    assert.equal(outbound.mutationId, uuidV5(IMPORT_ID, `mutation:event:${outbound.id}`))
    for (const m of p.mutations) {
      assert.equal(m.mutation.tripId, TRIP_ID)
      assert.equal(m.mutation.changedAt, '2026-11-07T10:00:00.000Z')
    }
    const segments = mutationsOf(p, 'segment')
    assert.lengthOf(segments, 2)
    assert.equal(segments[0].changes['eventId'], outbound.id)
    const seats = mutationsOf(p, 'seat')
    assert.lengthOf(seats, 3)
    assert.equal(seats[2].changes['documentId'], uuidV5(IMPORT_ID, 'document:document-1'))
    assert.deepEqual(p.counts, {
      stops: 3,
      events: 4,
      segments: 2,
      seats: 3,
      expenses: 3,
      tasks: 3,
      documents: 2,
    })
  })

  test('the first traveller becomes the caller and keeps the caller name', async ({ assert }) => {
    const p = plan(await fixture())

    const travellers = mutationsOf(p, 'traveller')
    assert.equal(travellers[0].id, CALLER_TRAVELLER)
    assert.deepEqual(travellers[0].changes, { position: 0 })
    assert.deepEqual(travellers[1].changes, { displayName: 'Partner', position: 1 })
    const [dinner] = mutationsOf(p, 'expense')
    assert.equal(dinner.changes['paidByTravellerId'], CALLER_TRAVELLER)
    assert.deepEqual(
      (dinner.changes['shares'] as { travellerId: string }[]).map((s) => s.travellerId),
      [CALLER_TRAVELLER, uuidV5(IMPORT_ID, 'traveller:traveller-2')]
    )
    assert.includeDeepMembers(p.warnings, [
      { code: 'callerIsFirstTraveller', count: 1 },
      { code: 'membersNotImported', count: 1 },
    ])
  })

  test('default categories update the new trip rows, custom ones are created, expenses keep their rate', async ({
    assert,
  }) => {
    const p = plan(await fixture())

    const categories = mutationsOf(p, 'budget_category')
    const accommodation = categories.find((c) => c.id === DEFAULT_CATEGORIES[0].id)!
    assert.deepEqual(accommodation.changes, { budgetMinor: 500000, position: 0 })
    const souvenirs = categories.find((c) => c.changes['name'] === 'Souvenirs')!
    assert.equal(souvenirs.id, uuidV5(IMPORT_ID, 'budget_category:category-7'))
    const [dinner, train, pending] = mutationsOf(p, 'expense')
    assert.equal(dinner.changes['categoryId'], DEFAULT_CATEGORIES[2].id)
    assert.include(dinner.changes, { fxRate: '22.5', fxSource: 'manual', fxRateDate: '2027-01-21' })
    assert.notProperty(dinner.changes, 'baseAmountMinor')
    assert.equal(train.changes['categoryId'], souvenirs.id)
    assert.include(pending.changes, { fxRate: null, needsDetails: true })
  })

  test('a file document becomes a link to its download url, a print task only replays its done state', async ({
    assert,
  }) => {
    const p = plan(await fixture())

    const [voucher, tickets] = mutationsOf(p, 'document')
    assert.include(voucher.changes, {
      kind: 'link',
      url: 'http://127.0.0.1:3333/drive/fs/trips/demo/voucher?signature=demo',
    })
    assert.deepEqual(voucher.changes['tags'], ['print'])
    assert.include(tickets.changes, { kind: 'link', url: 'https://example.com/tickets/demo' })
    const tasks = mutationsOf(p, 'task')
    assert.lengthOf(tasks, 2)
    assert.deepEqual(p.printTasksDone, [
      { documentId: voucher.id, doneAt: '2026-11-05T09:00:00.000Z' },
    ])
    assert.includeDeepMembers(p.warnings, [{ code: 'fileDocumentAsLink', count: 1 }])
  })

  test('a file document without a download url is left out and its seat loses the ticket', async ({
    assert,
  }) => {
    const document = await fixture()
    document.documents[0].downloadUrl = null

    const p = plan(document)

    assert.lengthOf(mutationsOf(p, 'document'), 1)
    assert.equal(p.counts.documents, 1)
    assert.isNull(mutationsOf(p, 'seat')[2].changes['documentId'])
    assert.deepEqual(p.printTasksDone, [])
    assert.includeDeepMembers(p.warnings, [{ code: 'fileDocumentSkipped', count: 1 }])
  })

  test('generated tasks become manual tasks and phrase cards are left out, with a warning each', async ({
    assert,
  }) => {
    const document = await fixture()
    document.tasks[0].origin = 'template'
    document.tasks[0].templateItemKey = 'passport'
    document.phraseCards = [{ language: 'th', cards: [], model: null }]

    const p = plan(document)

    const [renew] = mutationsOf(p, 'task')
    assert.notProperty(renew.changes, 'origin')
    assert.notProperty(renew.changes, 'templateItemKey')
    assert.includeDeepMembers(p.warnings, [
      { code: 'taskOriginReset', count: 1 },
      { code: 'phraseCardsSkipped', count: 1 },
    ])
  })

  test('emergency content travels as one mutation keyed by the trip', async ({ assert }) => {
    const p = plan(await fixture())

    const [emergency] = mutationsOf(p, 'emergency')
    assert.equal(emergency.id, TRIP_ID)
    assert.deepEqual(Object.keys(emergency.changes), ['contacts', 'notes'])
  })

  test('an unresolved or repeated ref reports its path and plans nothing', async ({ assert }) => {
    const document = await fixture()
    document.events[1].stopRef = 'stop-9'
    document.expenses[0].shares[1].travellerRef = 'traveller-9'
    document.stops[2].ref = 'stop-1'

    const result = planTripImport({
      document,
      importId: IMPORT_ID,
      tripId: TRIP_ID,
      callerTravellerId: CALLER_TRAVELLER,
      defaultCategories: DEFAULT_CATEGORIES,
      changedAt: '2026-11-07T10:00:00.000Z',
    })

    assert.isFalse(result.ok)
    if (result.ok) return
    assert.sameDeepMembers(result.problems, [
      { field: 'stops[2].ref', rule: 'duplicateRef' },
      { field: 'events[1].stopRef', rule: 'unresolvedRef' },
      { field: 'expenses[0].shares[1].travellerRef', rule: 'unresolvedRef' },
    ])
  })

  test('a minimal file keeps the default categories and fills the defaults', ({ assert }) => {
    const document = withTripJsonDefaults(
      {
        version: 'trip-json-v1',
        trip: {
          name: 'Weekend',
          baseCurrency: 'eur',
          startsOn: '2027-03-05',
          endsOn: '2027-03-07',
        },
        expenses: [
          {
            amountMinor: 1200,
            currency: 'eur',
            spentOn: '2027-03-06',
            categoryRef: 'category-food',
          },
        ],
      } as never,
      { homeTz: 'Europe/Madrid' }
    )

    assert.equal(document.trip.homeTz, 'Europe/Madrid')
    assert.equal(document.trip.baseCurrency, 'EUR')
    assert.equal(document.trip.budgetMode, 'shared')
    const p = plan(document)
    assert.lengthOf(mutationsOf(p, 'budget_category'), 0)
    const [expense] = mutationsOf(p, 'expense')
    assert.equal(expense.changes['categoryId'], DEFAULT_CATEGORIES[2].id)
    assert.equal(expense.changes['currency'], 'EUR')
    assert.deepEqual(p.warnings, [])
  })
})
