import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { Expense } from '@monkitrips/shared'
import { FakeFxRateProvider } from '#services/fx/fake_fx_rate_provider'
import { FxRateProvider } from '#services/fx/fx_rate_provider'
import { actingAs } from '#tests/helpers/acting_as'
import { makeUser } from '#tests/helpers/make_user'
import { makeTrip } from '#tests/helpers/make_trip'
import { useFixedClock } from '#tests/helpers/fixed_clock'
import { mutation, pushApplied, pushOne } from '#tests/helpers/sync'

test.group('Expenses', (group) => {
  useFixedClock(group, new Date('2027-01-25T10:00:00Z'))
  const fx = new FakeFxRateProvider()
  group.each.setup(() => {
    fx.unavailable = false
    fx.calls.length = 0
    app.container.swap(FxRateProvider, () => fx)
    return () => app.container.restore(FxRateProvider)
  })

  test('an expense with a fixed rate stores the converted base amount', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner) // base AUD

    const expense = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 45000,
        currency: 'thb',
        fxRate: '22.5',
        spentOn: '2027-01-22',
        description: 'Street food',
      })
    )

    assert.include(expense, {
      currency: 'THB',
      fxRate: '22.5',
      fxSource: 'manual',
      fxRateDate: '2027-01-22',
      baseAmountMinor: 2000,
      createdBy: owner.id,
    })
    assert.deepEqual(fx.calls, [])
  })

  test('quick capture without rate stores pending base amount', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    fx.unavailable = true

    const expense = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 1900,
        currency: 'JPY',
        spentOn: '2027-01-23',
        needsDetails: true,
      })
    )

    assert.isNull(expense.fxRate)
    assert.isNull(expense.baseAmountMinor)
    assert.isNull(expense.fxSource)
    assert.isTrue(expense.needsDetails)
    const budget = await actingAs(client.get(`/api/v1/trips/${trip.id}/budget`), owner)
    assert.equal(budget.body().data.pendingFxCount, 1)
    assert.equal(budget.body().data.spentMinor, 0)
  })

  test('sync fills missing rate from the spend date', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    await db.table('fx_rates').insert({
      base: 'AUD',
      quote: 'JPY',
      rate_on: '2027-01-23',
      rate: '95',
      source: 'frankfurter',
    })
    const id = randomUUID()
    fx.unavailable = true
    const pending = await pushApplied<Expense>(
      client,
      owner,
      mutation(
        trip.id,
        'expense',
        { amountMinor: 1900, currency: 'JPY', spentOn: '2027-01-24' },
        { id, changedAt: '2027-01-25T08:00:00.000Z' }
      )
    )
    assert.isNull(pending.fxRate)
    assert.isNull(pending.baseAmountMinor)

    // Still offline for the provider, but the spend date now has a cached rate.
    const fixed = await pushApplied<Expense>(
      client,
      owner,
      mutation(
        trip.id,
        'expense',
        { spentOn: '2027-01-23' },
        { id, changedAt: '2027-01-25T09:00:00.000Z' }
      )
    )

    assert.include(fixed, {
      fxRate: '95',
      fxSource: 'frankfurter',
      fxRateDate: '2027-01-23',
      baseAmountMinor: 2000,
    })
  })

  test('a missing rate is fetched from the provider and cached for the spend date', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const expense = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 45000, currency: 'THB', spentOn: '2027-01-22' })
    )

    // fake: 1 AUD = 33.75 / 1.5 = 22.5 THB
    assert.include(expense, { fxRate: '22.5', fxSource: 'frankfurter', baseAmountMinor: 2000 })
    assert.deepEqual(fx.calls, [{ base: 'AUD', symbols: ['THB'], date: '2027-01-22' }])
    const [cached] = await db
      .from('fx_rates')
      .where({ base: 'AUD', quote: 'THB', rate_on: '2027-01-22' })
    assert.equal(Number(cached.rate), 22.5)
  })

  test('an expense in the base currency has the identity rate', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const expense = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: -1500, currency: 'AUD', spentOn: '2027-01-22' })
    )

    assert.include(expense, { fxRate: '1', fxSource: 'identity', baseAmountMinor: -1500 })
  })

  test('a zero amount is refused', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)

    const result = await pushOne(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 0, currency: 'AUD', spentOn: '2027-01-22' })
    )

    assert.deepEqual(
      result.error?.errors?.map((e) => [e.field, e.rule]),
      [['amountMinor', 'notZero']]
    )
  })

  test('split shares must sum to the amount', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const [traveller] = await db.from('travellers').where('trip_id', trip.id)
    const friend = await pushApplied<{ id: string }>(
      client,
      owner,
      mutation(trip.id, 'traveller', { displayName: 'Friend without the app', position: 1 })
    )

    const wrong = await pushOne(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 3000,
        currency: 'AUD',
        spentOn: '2027-01-22',
        shares: [
          { id: randomUUID(), travellerId: traveller.id, shareMinor: 1000 },
          { id: randomUUID(), travellerId: friend.id, shareMinor: 1000 },
        ],
      })
    )
    const right = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 3000,
        currency: 'AUD',
        spentOn: '2027-01-22',
        shares: [
          { id: randomUUID(), travellerId: traveller.id, shareMinor: 2000 },
          { id: randomUUID(), travellerId: friend.id, shareMinor: 1000 },
        ],
      })
    )

    assert.equal(wrong.status, 'rejected')
    assert.deepEqual(
      wrong.error?.errors?.map((e) => [e.field, e.rule]),
      [['shares', 'sharesSum']]
    )
    const shares = await db
      .from('expense_shares')
      .where('expense_id', right.id)
      .whereNull('deleted_at')
    assert.sameMembers(
      shares.map((share) => Number(share.share_minor)),
      [2000, 1000]
    )
  })

  test('a share id of another trip is rejected and the victim row is unchanged', async ({
    client,
    assert,
  }) => {
    const victim = await makeUser()
    const attacker = await makeUser()
    const victimTrip = await makeTrip(victim)
    const ownTrip = await makeTrip(attacker)
    const [victimTraveller] = await db.from('travellers').where('trip_id', victimTrip.id)
    const [ownTraveller] = await db.from('travellers').where('trip_id', ownTrip.id)
    const victimShareId = randomUUID()
    const victimExpense = await pushApplied<Expense>(
      client,
      victim,
      mutation(victimTrip.id, 'expense', {
        amountMinor: 1000,
        currency: 'AUD',
        spentOn: '2027-01-22',
        shares: [{ id: victimShareId, travellerId: victimTraveller.id, shareMinor: 1000 }],
      })
    )
    const [before] = await db.from('expense_shares').where('id', victimShareId)

    const stolen = await pushOne(
      client,
      attacker,
      mutation(ownTrip.id, 'expense', {
        amountMinor: 5,
        currency: 'AUD',
        spentOn: '2027-01-22',
        shares: [{ id: victimShareId, travellerId: ownTraveller.id, shareMinor: 5 }],
      })
    )

    assert.equal(stolen.status, 'rejected')
    assert.equal(stolen.error?.code, 'E_ROW_NOT_FOUND')
    assert.notProperty(stolen, 'row')
    const [after] = await db.from('expense_shares').where('id', victimShareId)
    assert.deepEqual(after, before)
    assert.include(after, {
      trip_id: victimTrip.id,
      expense_id: victimExpense.id,
      traveller_id: victimTraveller.id,
    })
    assert.isEmpty(await db.from('expenses').where('trip_id', ownTrip.id))
  })

  test('a share id of another expense of the same trip is rejected', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner)
    const [traveller] = await db.from('travellers').where('trip_id', trip.id)
    const shareId = randomUUID()
    const first = await pushApplied<Expense>(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 1000,
        currency: 'AUD',
        spentOn: '2027-01-22',
        shares: [{ id: shareId, travellerId: traveller.id, shareMinor: 1000 }],
      })
    )

    const moved = await pushOne(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 300,
        currency: 'AUD',
        spentOn: '2027-01-22',
        shares: [{ id: shareId, travellerId: traveller.id, shareMinor: 300 }],
      })
    )

    assert.equal(moved.status, 'rejected')
    assert.equal(moved.error?.code, 'E_ROW_NOT_FOUND')
    const [share] = await db.from('expense_shares').where('id', shareId)
    assert.equal(share.expense_id, first.id)
    assert.equal(Number(share.share_minor), 1000)
    assert.isNull(share.deleted_at)
  })

  test('the budget view sums converted expenses by category', async ({ client, assert }) => {
    const owner = await makeUser()
    const trip = await makeTrip(owner, {
      budgetTotalMinor: 100000,
      startsOn: '2027-01-20',
      endsOn: '2027-01-29',
    })
    const [food] = await db.from('budget_categories').where({ trip_id: trip.id, key: 'food' })
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'expense', {
        amountMinor: 4000,
        currency: 'AUD',
        spentOn: '2027-01-21',
        categoryId: food.id,
      })
    )
    await pushApplied(
      client,
      owner,
      mutation(trip.id, 'expense', { amountMinor: 1000, currency: 'AUD', spentOn: '2027-01-25' })
    )

    const response = await actingAs(client.get(`/api/v1/trips/${trip.id}/budget`), owner)

    response.assertStatus(200)
    const budget = response.body().data
    assert.include(budget, {
      baseCurrency: 'AUD',
      budgetMinor: 100000,
      spentMinor: 5000,
      remainingMinor: 95000,
      // (100000 - 4000) / 5 days left (25th..29th) = 19200; 1000 spent today.
      allowanceTodayMinor: 19200,
      spentTodayMinor: 1000,
      leftTodayMinor: 18200,
      pendingFxCount: 0,
    })
    const line = budget.perCategory.find((c: { categoryId: string }) => c.categoryId === food.id)
    assert.equal(line.spentMinor, 4000)
  })

  test('fx rates come from the cache or the provider, and 503 when neither can answer', async ({
    client,
    assert,
  }) => {
    const owner = await makeUser()

    const response = await actingAs(client.get('/api/v1/fx/rates'), owner).qs({
      base: 'aud',
      symbols: 'THB,JPY,AUD,XXX',
      date: '2027-01-22',
    })
    response.assertStatus(200)
    assert.deepEqual(response.body().data, [
      { base: 'AUD', quote: 'AUD', rateOn: '2027-01-22', rate: '1', source: 'identity' },
      { base: 'AUD', quote: 'THB', rateOn: '2027-01-22', rate: '22.5', source: 'frankfurter' },
      { base: 'AUD', quote: 'JPY', rateOn: '2027-01-22', rate: '95', source: 'frankfurter' },
    ])

    fx.unavailable = true
    const cached = await actingAs(client.get('/api/v1/fx/rates'), owner).qs({
      base: 'AUD',
      symbols: 'THB',
      date: '2027-01-22',
    })
    cached.assertStatus(200)
    const down = await actingAs(client.get('/api/v1/fx/rates'), owner).qs({
      base: 'AUD',
      symbols: 'THB',
      date: '2027-01-23',
    })
    down.assertStatus(503)
    down.assertBodyContains({ code: 'E_FX_UNAVAILABLE' })
  })
})
