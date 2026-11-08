import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { Expense } from '@monkitrips/shared'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pushApplied } from '#tests/helpers/sync'

/** The records of a CSV body without the BOM and the header. */
function records(body: string): string[] {
  return body
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .slice(1, -1)
}

async function travellerOf(tripId: string, userId: string): Promise<string> {
  const row = await db.from('travellers').where({ trip_id: tripId, user_id: userId }).first()
  return row.id
}

async function categoryId(tripId: string, key: string): Promise<string> {
  const row = await db.from('budget_categories').where({ trip_id: tripId, key }).first()
  return row.id
}

test.group('Trip expenses CSV', (group) => {
  useFixedClock(group, new Date('2026-11-07T12:00:00Z'))

  test('csv uses decimal amounts from minor units', async ({ client, assert }) => {
    const owner = await makeUser({ displayName: 'Traveller A' })
    const trip = await makeTrip(owner, { baseCurrency: 'AUD' })
    await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 1_200,
        currency: 'JPY',
        fxRate: '100',
        spentOn: '2027-01-22',
        description: 'Ramen',
        categoryId: await categoryId(trip.id, 'food'),
      })
    )
    await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 4250,
        currency: 'AUD',
        spentOn: '2027-01-21',
        description: 'Groceries',
      })
    )

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/expenses.csv`), owner)

    response.assertStatus(200)
    assert.match(response.header('content-type') ?? '', /^text\/csv; charset=utf-8/)
    assert.equal(
      response.header('content-disposition'),
      'attachment; filename="trip-demo-loop-expenses-2026-11-07.csv"'
    )
    assert.equal(response.header('cache-control'), 'no-store')
    const body = response.text()
    assert.isTrue(body.startsWith('\uFEFF'))
    assert.equal(
      body.replace(/^\uFEFF/, '').split('\r\n')[0],
      'date,description,category,amount,currency,base_amount,base_currency,fx_rate,paid_by,split_with,kind,trip'
    )
    assert.deepEqual(records(body), [
      '2027-01-21,Groceries,,42.50,AUD,42.50,AUD,1,,,expense,Demo Loop',
      '2027-01-22,Ramen,food,1200,JPY,12.00,AUD,100,,,expense,Demo Loop',
    ])
  })

  test('csv escapes formula cells', async ({ client, assert }) => {
    const owner = await makeUser({ displayName: '=Traveller' })
    const trip = await makeTrip(owner, { name: '@Trip' })
    await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: -500,
        currency: 'AUD',
        spentOn: '2027-01-21',
        description: '=HYPERLINK("https://example.com")',
        paidByTravellerId: await travellerOf(trip.id, owner.id),
      })
    )

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/expenses.csv`), owner)

    response.assertStatus(200)
    assert.deepEqual(records(response.text()), [
      `2027-01-21,"'=HYPERLINK(""https://example.com"")",,-5.00,AUD,-5.00,AUD,1,'=Traveller,,expense,'@Trip`,
    ])
  })

  test('settlements are marked', async ({ client, assert }) => {
    const owner = await makeUser({ displayName: 'Traveller A' })
    const editor = await makeUser({ displayName: 'Traveller B' })
    const trip = await makeTrip(owner)
    await addMember(trip, editor)
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'trip', { budgetMode: 'split' }, { id: trip.id })
    )
    const travellers = (await db
      .from('travellers')
      .where('trip_id', trip.id)
      .whereNull('deleted_at')
      .select('id', 'user_id')) as { id: string; user_id: string }[]
    const a = travellers.find((row) => row.user_id === owner.id)!.id
    const b = travellers.find((row) => row.user_id === editor.id)!.id
    await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 3000,
        currency: 'AUD',
        spentOn: '2027-01-21',
        description: 'Taxi',
        paidByTravellerId: a,
        shares: [
          { id: randomUUID(), travellerId: a, shareMinor: 1500 },
          { id: randomUUID(), travellerId: b, shareMinor: 1500 },
        ],
      })
    )
    await pushApplied<Expense>(
      client,
      editor,
      mutation(trip.id, 'expense', {
        kind: 'settlement',
        amountMinor: 1500,
        currency: 'AUD',
        spentOn: '2027-01-22',
        description: 'Settle up',
        paidByTravellerId: b,
        shares: [{ id: randomUUID(), travellerId: a, shareMinor: 1500 }],
      })
    )
    const removed = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 999, currency: 'AUD', spentOn: '2027-01-23' })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'expense', {}, { id: removed.id, op: 'delete' })
    )
    const waiting = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 30_000, currency: 'THB', spentOn: '2027-01-24' })
    )
    // As if the rate provider had not answered yet.
    await db
      .from('expenses')
      .where('id', waiting.id)
      .update({ fx_rate: null, fx_source: null, fx_rate_date: null, base_amount_minor: null })

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/expenses.csv`), editor)

    response.assertStatus(200)
    const lines = records(response.text())
    assert.deepEqual(lines.slice(0, 2), [
      '2027-01-21,Taxi,,30.00,AUD,30.00,AUD,1,Traveller A,Traveller A; Traveller B,expense,Demo Loop',
      '2027-01-22,Settle up,,15.00,AUD,15.00,AUD,1,Traveller B,Traveller A,settlement,Demo Loop',
    ])
    // Deleted expenses are left out; one waiting for its rate has empty base columns.
    assert.lengthOf(lines, 3)
    assert.match(lines[2]!, /^2027-01-24,,,300\.00,THB,,,,Traveller A,/)
  })

  test('csv answers 404 to non members', async ({ client }) => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/expenses.csv`), stranger)

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
  })
})
