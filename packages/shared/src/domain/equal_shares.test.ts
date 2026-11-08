import { test } from 'node:test'
import assert from 'node:assert/strict'
import { equalShares } from './equal_shares.ts'

test('splits evenly when the amount divides', () => {
  assert.deepEqual(equalShares(9_000, ['a', 'b', 'c'], 'a'), [
    { travellerId: 'a', shareMinor: 3_000 },
    { travellerId: 'b', shareMinor: 3_000 },
    { travellerId: 'c', shareMinor: 3_000 },
  ])
})

test('the remainder goes to the payer when the payer shares', () => {
  assert.deepEqual(
    equalShares(1_000, ['a', 'b', 'c'], 'b').map((row) => row.shareMinor),
    [333, 334, 333]
  )
})

test('the remainder goes to the first participant when the payer does not share', () => {
  assert.deepEqual(
    equalShares(1_000, ['a', 'b', 'c'], 'z').map((row) => row.shareMinor),
    [334, 333, 333]
  )
})

test('a refund splits into negative shares that add up', () => {
  const shares = equalShares(-1_000, ['a', 'b', 'c'], 'a')
  assert.deepEqual(
    shares.map((row) => row.shareMinor),
    [-334, -333, -333]
  )
})

test('no participants means no shares', () => {
  assert.deepEqual(equalShares(1_000, [], 'a'), [])
})
