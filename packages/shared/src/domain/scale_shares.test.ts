import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scaleShares } from './scale_shares.ts'

const amounts = (rows: { shareMinor: number }[]) => rows.map((row) => row.shareMinor)

test('a custom split keeps its proportions for a new amount, the remainder on the payer', () => {
  const shares = [
    { travellerId: 'a', shareMinor: 1000 },
    { travellerId: 'b', shareMinor: 3500 },
  ]
  // 1001 × 1000/4500 = 222.4, 1001 × 3500/4500 = 778.5: one cent left, for the payer b.
  assert.deepEqual(amounts(scaleShares(1001, shares, 'b')), [222, 779])
  assert.deepEqual(amounts(scaleShares(9000, shares, 'b')), [2000, 7000])
})

test('the remainder goes to the first person when the payer does not share', () => {
  const shares = [
    { travellerId: 'a', shareMinor: 1 },
    { travellerId: 'b', shareMinor: 1 },
    { travellerId: 'c', shareMinor: 1 },
  ]
  assert.deepEqual(amounts(scaleShares(100, shares, 'z')), [34, 33, 33])
})

test('a refund scales into negative shares that still add up', () => {
  const shares = [
    { travellerId: 'a', shareMinor: 2000 },
    { travellerId: 'b', shareMinor: 1000 },
  ]
  const scaled = scaleShares(-1000, shares, 'a')
  assert.deepEqual(amounts(scaled), [-667, -333])
})

test('shares that add up to nothing split the new amount equally', () => {
  const shares = [
    { travellerId: 'a', shareMinor: 0 },
    { travellerId: 'b', shareMinor: 0 },
  ]
  assert.deepEqual(amounts(scaleShares(1001, shares, 'a')), [501, 500])
})
