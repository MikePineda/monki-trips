import { test } from 'node:test'
import assert from 'node:assert/strict'
import { balances, type BalanceExpense, type BalanceShare } from './balances.ts'

const A = 'traveller-a'
const B = 'traveller-b'
const C = 'traveller-c'
const D = 'traveller-d'

function expense(
  id: string,
  paidBy: string | null,
  amountMinor: number,
  baseAmountMinor: number | null = amountMinor
): BalanceExpense {
  return { id, paidByTravellerId: paidBy, amountMinor, baseAmountMinor }
}

function share(expenseId: string, travellerId: string, shareMinor: number): BalanceShare {
  return { expenseId, travellerId, shareMinor }
}

function net(result: ReturnType<typeof balances>): Record<string, bigint> {
  return Object.fromEntries(result.balances.map((row) => [row.travellerId, row.netMinor]))
}

test('dinner paid by one and split between two', () => {
  const result = balances({
    travellers: [A, B, C],
    expenses: [expense('dinner', A, 9_000)],
    shares: [share('dinner', A, 4_500), share('dinner', B, 4_500)],
  })
  assert.deepEqual(net(result), { [A]: 4_500n, [B]: -4_500n, [C]: 0n })
  assert.deepEqual(result.settlements, [
    { fromTravellerId: B, toTravellerId: A, amountMinor: 4_500n },
  ])
  const paid = result.balances.find((row) => row.travellerId === A)
  assert.equal(paid?.paidMinor, 9_000n)
  assert.equal(paid?.owedMinor, 4_500n)
})

test('people with no activity stay at zero and in the order given', () => {
  const result = balances({ travellers: [C, A, B], expenses: [], shares: [] })
  assert.deepEqual(
    result.balances.map((row) => [row.travellerId, row.netMinor]),
    [
      [C, 0n],
      [A, 0n],
      [B, 0n],
    ]
  )
  assert.deepEqual(result.settlements, [])
})

test('unequal shares follow the amounts given', () => {
  const result = balances({
    travellers: [A, B, C],
    expenses: [expense('taxi', B, 10_000)],
    shares: [share('taxi', A, 2_000), share('taxi', B, 3_000), share('taxi', C, 5_000)],
  })
  assert.deepEqual(net(result), { [A]: -2_000n, [B]: 7_000n, [C]: -5_000n })
})

test('an expense without shares is split equally among every traveller', () => {
  const result = balances({
    travellers: [A, B, C],
    expenses: [expense('groceries', A, 3_000)],
    shares: [],
  })
  assert.deepEqual(net(result), { [A]: 2_000n, [B]: -1_000n, [C]: -1_000n })
})

test('an expense without a payer falls back to the default payer, or is counted apart', () => {
  const input = {
    travellers: [A, B],
    expenses: [expense('museum', null, 2_000)],
    shares: [share('museum', A, 1_000), share('museum', B, 1_000)],
  }
  const fallback = balances({ ...input, defaultPayerTravellerId: A })
  assert.deepEqual(net(fallback), { [A]: 1_000n, [B]: -1_000n })
  const apart = balances(input)
  assert.deepEqual(net(apart), { [A]: 0n, [B]: 0n })
  assert.equal(apart.unassignedCount, 1)
})

test('pending fx expenses are excluded and counted', () => {
  const result = balances({
    travellers: [A, B],
    expenses: [expense('lunch', A, 2_000), expense('market', B, 50_000, null)],
    shares: [
      share('lunch', A, 1_000),
      share('lunch', B, 1_000),
      share('market', A, 25_000),
      share('market', B, 25_000),
    ],
  })
  assert.deepEqual(net(result), { [A]: 1_000n, [B]: -1_000n })
  assert.equal(result.pendingFxCount, 1)
})

test('refund reverses a share', () => {
  const result = balances({
    travellers: [A, B],
    expenses: [expense('hotel', A, 20_000), expense('refund', A, -4_000)],
    shares: [
      share('hotel', A, 10_000),
      share('hotel', B, 10_000),
      share('refund', A, -2_000),
      share('refund', B, -2_000),
    ],
  })
  assert.deepEqual(net(result), { [A]: 8_000n, [B]: -8_000n })
  assert.deepEqual(result.settlements, [
    { fromTravellerId: B, toTravellerId: A, amountMinor: 8_000n },
  ])
})

test('rounding remainder goes to the payer', () => {
  // Three units of a foreign currency, shared one each, worth 1.00 of the base.
  const result = balances({
    travellers: [A, B, C],
    expenses: [expense('snack', A, 3, 100)],
    shares: [share('snack', A, 1), share('snack', B, 1), share('snack', C, 1)],
  })
  assert.deepEqual(net(result), { [A]: 66n, [B]: -33n, [C]: -33n })
  const payer = result.balances.find((row) => row.travellerId === A)
  assert.equal(payer?.owedMinor, 34n)
})

test('the nets of a trip always add up to zero', () => {
  const result = balances({
    travellers: [A, B, C],
    expenses: [expense('one', A, 7, 1_001), expense('two', B, 11, 997)],
    shares: [
      share('one', A, 2),
      share('one', B, 2),
      share('one', C, 3),
      share('two', A, 5),
      share('two', C, 6),
    ],
  })
  const total = result.balances.reduce((sum, row) => sum + row.netMinor, 0n)
  assert.equal(total, 0n)
})

test('settle up uses at most n minus one transfers', () => {
  const result = balances({
    travellers: [A, B, C, D],
    expenses: [expense('flat', A, 40_000), expense('car', B, 20_000), expense('food', C, 4_000)],
    shares: [
      ...[A, B, C, D].map((id) => share('flat', id, 10_000)),
      ...[A, B, C, D].map((id) => share('car', id, 5_000)),
      ...[A, B, C, D].map((id) => share('food', id, 1_000)),
    ],
  })
  // A +24000, B +4000, C -12000, D -16000.
  assert.deepEqual(net(result), { [A]: 24_000n, [B]: 4_000n, [C]: -12_000n, [D]: -16_000n })
  assert.ok(result.settlements.length <= 3)
  assert.deepEqual(result.settlements, [
    { fromTravellerId: D, toTravellerId: A, amountMinor: 16_000n },
    { fromTravellerId: C, toTravellerId: A, amountMinor: 8_000n },
    { fromTravellerId: C, toTravellerId: B, amountMinor: 4_000n },
  ])
  // Applying the transfers settles everyone.
  const after = net(result)
  for (const transfer of result.settlements) {
    after[transfer.fromTravellerId] += transfer.amountMinor
    after[transfer.toTravellerId] -= transfer.amountMinor
  }
  assert.ok(Object.values(after).every((value) => value === 0n))
})

test('ties settle in the order the travellers were given', () => {
  const result = balances({
    travellers: [A, B, C, D],
    expenses: [expense('one', A, 2_000), expense('two', B, 2_000)],
    shares: [share('one', C, 2_000), share('two', D, 2_000)],
  })
  assert.deepEqual(result.settlements, [
    { fromTravellerId: C, toTravellerId: A, amountMinor: 2_000n },
    { fromTravellerId: D, toTravellerId: B, amountMinor: 2_000n },
  ])
})

test('shares of someone no longer travelling still count under their id', () => {
  const result = balances({
    travellers: [A],
    expenses: [expense('one', A, 2_000)],
    shares: [share('one', A, 1_000), share('one', B, 1_000)],
  })
  assert.deepEqual(net(result), { [A]: 1_000n, [B]: -1_000n })
})
