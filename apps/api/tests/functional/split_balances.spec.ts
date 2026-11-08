import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { Expense, TripBalancesView } from '@monkitrips/shared'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { addMember, makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { countQueries } from '#tests/helpers/count_queries'
import { mutation, pushApplied, pushOne } from '#tests/helpers/sync'

/** The live shares of an expense as `[travellerId, shareMinor]`, by traveller. */
async function liveShares(expenseId: string): Promise<[string, number][]> {
  const rows = (await db
    .from('expense_shares')
    .where('expense_id', expenseId)
    .whereNull('deleted_at')
    .orderBy('traveller_id')
    .select('traveller_id', 'share_minor')) as { traveller_id: string; share_minor: string }[]
  return rows.map((row) => [row.traveller_id, Number(row.share_minor)])
}

/** A trip of three: the owner, an editor and a friend without an account. */
async function tripOfThree(client: Parameters<typeof pushApplied>[0]) {
  const owner = await makeUser({ displayName: 'Traveller A' })
  const editor = await makeUser({ displayName: 'Traveller B' })
  const trip = await makeTrip(owner)
  await addMember(trip, editor)
  const friend = await pushApplied<{ id: string }>(
    client,
    owner,
    mutation(trip.id, 'traveller', { displayName: 'Traveller C', position: 2 })
  )
  const travellers = (await db
    .from('travellers')
    .where('trip_id', trip.id)
    .whereNull('deleted_at')
    .select('id', 'user_id')) as { id: string; user_id: string | null }[]
  const ownerTraveller = travellers.find((row) => row.user_id === owner.id)!.id
  const editorTraveller = travellers.find((row) => row.user_id === editor.id)!.id
  return { owner, editor, trip, ownerTraveller, editorTraveller, friendTraveller: friend.id }
}

test.group('Split budget mode', (group) => {
  useFixedClock(group, new Date('2026-11-07T12:00:00Z'))

  test('switching to split assigns payer and equal shares', async ({ client, assert }) => {
    const { owner, editor, trip, ownerTraveller, editorTraveller, friendTraveller } =
      await tripOfThree(client)
    const groceries = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 3000, currency: 'AUD', spentOn: '2027-01-21' })
    )
    const taxi = await pushApplied<Expense>(
      client,
      editor,
      mutation(trip.id, 'expense', {
        amountMinor: 1000,
        currency: 'AUD',
        spentOn: '2027-01-22',
        paidByTravellerId: editorTraveller,
      })
    )

    // The budget belongs to editors too, so an editor may switch the mode.
    const switched = await pushApplied<{ budgetMode: string }>(
      client,
      editor,
      mutation(trip.id, 'trip', { budgetMode: 'split' }, { id: trip.id })
    )

    assert.equal(switched.budgetMode, 'split')
    const groceriesRow = await db.from('expenses').where('id', groceries.id).first()
    const taxiRow = await db.from('expenses').where('id', taxi.id).first()
    assert.equal(groceriesRow.paid_by_traveller_id, ownerTraveller)
    assert.equal(taxiRow.paid_by_traveller_id, editorTraveller)
    const expected = (pairs: [string, number][]) => pairs.sort(([a], [b]) => a.localeCompare(b))
    assert.deepEqual(
      await liveShares(groceries.id),
      expected([
        [ownerTraveller, 1000],
        [editorTraveller, 1000],
        [friendTraveller, 1000],
      ])
    )
    // 10.00 between three: the remainder cent goes to the payer.
    assert.deepEqual(
      await liveShares(taxi.id),
      expected([
        [ownerTraveller, 333],
        [editorTraveller, 334],
        [friendTraveller, 333],
      ])
    )
    assert.isDefined(groceriesRow.field_clock.shares)
    assert.isDefined(groceriesRow.field_clock.paidByTravellerId)
    const activity = await db
      .from('trip_activity')
      .where('trip_id', trip.id)
      .where('entity', 'expense')
      .where('action', 'updated')
      .select('entity_id', 'fields')
    assert.sameDeepMembers(activity, [
      { entity_id: groceries.id, fields: ['paidByTravellerId', 'shares'] },
      { entity_id: taxi.id, fields: ['shares'] },
    ])
  })

  test('switching to split keeps a split the expense already has', async ({ client, assert }) => {
    const { owner, trip, ownerTraveller, friendTraveller } = await tripOfThree(client)
    const dinner = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 9000,
        currency: 'AUD',
        spentOn: '2027-01-21',
        paidByTravellerId: ownerTraveller,
        shares: [
          { id: randomUUID(), travellerId: ownerTraveller, shareMinor: 4500 },
          { id: randomUUID(), travellerId: friendTraveller, shareMinor: 4500 },
        ],
      })
    )

    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'trip', { budgetMode: 'split' }, { id: trip.id })
    )

    assert.lengthOf(await liveShares(dinner.id), 2)
  })

  test('an expense push answers the live shares the server keeps, whatever the outcome', async ({
    client,
    assert,
  }) => {
    const { owner, trip, ownerTraveller, friendTraveller } = await tripOfThree(client)
    const id = randomUUID()
    const kept = randomUUID()
    const applied = await pushOne(
      client,
      owner,
      mutation(
        trip.id,
        'expense',
        {
          amountMinor: 1000,
          currency: 'AUD',
          spentOn: '2027-01-21',
          shares: [{ id: kept, travellerId: ownerTraveller, shareMinor: 1000 }],
        },
        { id, changedAt: '2026-11-07T11:00:00.000Z' }
      )
    )
    const stale = await pushOne(
      client,
      owner,
      mutation(
        trip.id,
        'expense',
        { shares: [{ id: randomUUID(), travellerId: friendTraveller, shareMinor: 1000 }] },
        { id, changedAt: '2026-11-07T09:00:00.000Z' }
      )
    )
    const wrong = await pushOne(
      client,
      owner,
      mutation(
        trip.id,
        'expense',
        {
          shares: [{ id: randomUUID(), travellerId: friendTraveller, shareMinor: 1 }],
        },
        { id, changedAt: '2026-11-07T11:30:00.000Z' }
      )
    )

    assert.equal(applied.status, 'applied')
    assert.equal(stale.status, 'partial')
    assert.equal(wrong.status, 'rejected')
    for (const result of [applied, stale, wrong]) {
      assert.deepEqual(
        result.shares?.map((share) => [share.id, share.travellerId, share.shareMinor]),
        [[kept, ownerTraveller, 1000]]
      )
    }
  })

  test('a stale device that changes only the amount after the switch gets an equal split again', async ({
    client,
    assert,
  }) => {
    const { owner, editor, trip, ownerTraveller, editorTraveller, friendTraveller } =
      await tripOfThree(client)
    const taxi = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 3000, currency: 'AUD', spentOn: '2027-01-21' })
    )
    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'trip',
        { budgetMode: 'split' },
        { id: trip.id, changedAt: '2026-11-07T10:00:00.000Z' }
      )
    )

    // The editor's device still thinks the trip is shared and only knows the amount.
    const result = await pushOne(
      client,
      editor,
      mutation(
        trip.id,
        'expense',
        { amountMinor: 1000 },
        { id: taxi.id, changedAt: '2026-11-07T11:00:00.000Z' }
      )
    )

    assert.equal(result.status, 'applied')
    const expected = [
      [ownerTraveller, 334],
      [editorTraveller, 333],
      [friendTraveller, 333],
    ] as [string, number][]
    assert.sameDeepMembers(await liveShares(taxi.id), expected)
    const row = await db.from('expenses').where('id', taxi.id).first()
    assert.equal(row.field_clock.shares, Date.parse('2026-11-07T11:00:00.000Z'))
  })

  test('an expense pushed to a split trip without a split gets equal shares and the owner as payer', async ({
    client,
    assert,
  }) => {
    const { owner, editor, trip, ownerTraveller, editorTraveller, friendTraveller } =
      await tripOfThree(client)
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'trip', { budgetMode: 'split' }, { id: trip.id })
    )

    // Made on a device that has not pulled the switch yet: no payer, no shares.
    const late = await pushApplied<Expense>(
      client,
      editor,
      mutation(trip.id, 'expense', { amountMinor: 3000, currency: 'AUD', spentOn: '2027-01-22' })
    )

    const row = await db.from('expenses').where('id', late.id).first()
    assert.equal(row.paid_by_traveller_id, ownerTraveller)
    assert.sameDeepMembers(await liveShares(late.id), [
      [ownerTraveller, 1000],
      [editorTraveller, 1000],
      [friendTraveller, 1000],
    ])
  })

  test('switching to split leaves a payer alone whose clock is newer than the switch', async ({
    client,
    assert,
  }) => {
    const { owner, trip } = await tripOfThree(client)
    const museum = await pushApplied<Expense>(
      client,
      owner,
      mutation(
        trip.id,
        'expense',
        { amountMinor: 3000, currency: 'AUD', spentOn: '2027-01-21', paidByTravellerId: null },
        { changedAt: '2026-11-07T11:00:00.000Z' }
      )
    )

    // An older switch, made offline, arrives after the payer was cleared on purpose.
    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'trip',
        { budgetMode: 'split' },
        { id: trip.id, changedAt: '2026-11-07T09:00:00.000Z' }
      )
    )

    const row = await db.from('expenses').where('id', museum.id).first()
    assert.isNull(row.paid_by_traveller_id)
    assert.equal(row.field_clock.paidByTravellerId, Date.parse('2026-11-07T11:00:00.000Z'))
    assert.equal(row.field_clock.shares, Date.parse('2026-11-07T09:00:00.000Z'))
    assert.lengthOf(await liveShares(museum.id), 3)
  })

  test('switching to split writes in bulk, whatever the number of expenses', async ({
    client,
    assert,
  }) => {
    const queriesFor = async (expenses: number) => {
      const { owner, trip } = await tripOfThree(client)
      for (let index = 0; index < expenses; index++) {
        await pushApplied(
          client,
          owner,
          mutation(trip.id, 'expense', {
            amountMinor: 1000 + index,
            currency: 'AUD',
            spentOn: '2027-01-21',
          })
        )
      }
      const switchTo = mutation(trip.id, 'trip', { budgetMode: 'split' }, { id: trip.id })
      return countQueries(() => pushApplied(client, owner, switchTo))
    }

    const few = await queriesFor(2)
    const many = await queriesFor(12)

    assert.equal(many, few)
    const activity = await db
      .from('trip_activity')
      .where('entity', 'expense')
      .where('action', 'updated')
    assert.lengthOf(activity, 14)
  })

  test('switching back to shared keeps payers and shares', async ({ client, assert }) => {
    const { owner, trip, ownerTraveller } = await tripOfThree(client)
    const groceries = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 3000, currency: 'AUD', spentOn: '2027-01-21' })
    )
    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'trip',
        { budgetMode: 'split' },
        { id: trip.id, changedAt: '2026-11-07T10:00:00.000Z' }
      )
    )

    await pushApplied(
      client,
      owner,
      mutation(
        trip.id,
        'trip',
        { budgetMode: 'shared' },
        { id: trip.id, changedAt: '2026-11-07T11:00:00.000Z' }
      )
    )

    const row = await db.from('expenses').where('id', groceries.id).first()
    assert.equal(row.paid_by_traveller_id, ownerTraveller)
    assert.lengthOf(await liveShares(groceries.id), 3)
  })

  test('balances show who owes whom with the fewest transfers', async ({ client, assert }) => {
    const { owner, editor, trip, ownerTraveller, editorTraveller, friendTraveller } =
      await tripOfThree(client)
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'trip', { budgetMode: 'split' }, { id: trip.id })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 9000,
        currency: 'AUD',
        spentOn: '2027-01-21',
        paidByTravellerId: ownerTraveller,
        shares: [
          { id: randomUUID(), travellerId: ownerTraveller, shareMinor: 4500 },
          { id: randomUUID(), travellerId: friendTraveller, shareMinor: 4500 },
        ],
      })
    )

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/balances`), editor)

    response.assertStatus(200)
    const view = response.body().data as TripBalancesView
    assert.equal(view.budgetMode, 'split')
    assert.equal(view.baseCurrency, 'AUD')
    assert.deepEqual(
      view.balances.map((row) => [row.displayName, row.netMinor]),
      [
        ['Traveller A', 4500],
        ['Traveller B', 0],
        ['Traveller C', -4500],
      ]
    )
    assert.deepEqual(view.settlements, [
      { fromTravellerId: friendTraveller, toTravellerId: ownerTraveller, amountMinor: 4500 },
    ])
    assert.equal(view.pendingFxCount, 0)
    assert.equal(view.balances[1].travellerId, editorTraveller)
  })

  test('mark as settled zeroes the pair and leaves Spent unchanged', async ({ client, assert }) => {
    const { owner, trip, ownerTraveller, friendTraveller } = await tripOfThree(client)
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'trip', { budgetMode: 'split' }, { id: trip.id })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 9000,
        currency: 'AUD',
        spentOn: '2027-01-21',
        paidByTravellerId: ownerTraveller,
        shares: [
          { id: randomUUID(), travellerId: ownerTraveller, shareMinor: 4500 },
          { id: randomUUID(), travellerId: friendTraveller, shareMinor: 4500 },
        ],
      })
    )
    const read = async () => {
      const budget = await actingAs(client.get(`/api/v1/trips/${trip.id}/budget`), owner)
      const today = await actingAs(
        client.get(`/api/v1/trips/${trip.id}/today`).qs({ at: '2027-01-21T02:00:00.000Z' }),
        owner
      )
      return {
        spent: budget.body().data.spentMinor,
        categories: budget.body().data.perCategory,
        leftToday: today.body().data.leftTodayMinor,
      }
    }
    const before = await read()

    const settlement = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        kind: 'settlement',
        amountMinor: 4500,
        currency: 'AUD',
        spentOn: '2027-01-21',
        description: 'Settle up',
        paidByTravellerId: friendTraveller,
        shares: [{ id: randomUUID(), travellerId: ownerTraveller, shareMinor: 4500 }],
      })
    )

    assert.equal(settlement.kind, 'settlement')
    assert.deepEqual(await read(), before)
    assert.equal(before.spent, 9000)
    const balances = await actingAs(client.get(`/api/v1/trips/${trip.id}/balances`), owner)
    assert.deepEqual(
      balances.body().data.balances.map((row: { netMinor: number }) => row.netMinor),
      [0, 0, 0]
    )
  })

  test('the kind of an expense is set on insert and never changes', async ({ client, assert }) => {
    const { owner, trip } = await tripOfThree(client)
    const plain = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 1000, currency: 'AUD', spentOn: '2027-01-21' })
    )
    assert.equal(plain.kind, 'expense')

    const result = await pushOne(
      client,
      owner,
      mutation(trip.id, 'expense', { kind: 'settlement' }, { id: plain.id })
    )

    assert.equal(result.status, 'rejected')
    assert.deepEqual(
      result.error?.errors?.map((error) => [error.field, error.rule]),
      [['kind', 'immutable']]
    )
  })

  test('a settlement survives an export and an import', async ({ client, assert }) => {
    const { owner, trip, ownerTraveller, friendTraveller } = await tripOfThree(client)
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'expense', {
        kind: 'settlement',
        amountMinor: 4500,
        currency: 'AUD',
        spentOn: '2027-01-21',
        paidByTravellerId: friendTraveller,
        shares: [{ id: randomUUID(), travellerId: ownerTraveller, shareMinor: 4500 }],
      })
    )

    const exported = await actingAs(client.get(`/api/v1/trips/${trip.id}/export`), owner)
    const document = exported.body()
    assert.equal(document.expenses[0].kind, 'settlement')
    const imported = await actingAs(client.post('/api/v1/trips/import'), owner).json(document)
    imported.assertStatus(201)
    const snapshot = await actingAs(
      client.get(`/api/v1/trips/${imported.body().data.tripId}/snapshot`),
      owner
    )
    assert.equal(snapshot.body().data.expenses[0].kind, 'settlement')
  })

  test('balances answer 404 to non members', async ({ client }) => {
    const owner = await makeUser()
    const stranger = await makeUser()
    const trip = await makeTrip(owner)

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/balances`), stranger)

    response.assertStatus(404)
    response.assertBodyContains({ code: 'E_ROW_NOT_FOUND' })
  })
})
