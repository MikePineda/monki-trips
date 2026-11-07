import { test } from 'node:test'
import assert from 'node:assert/strict'
import { divideHalfEven, floorDiv, pow10, sumMinor, toMinor } from './minor_units.ts'

test('bigint, integer string and safe number all normalise to bigint', () => {
  assert.equal(toMinor(1250n), 1250n)
  assert.equal(toMinor('1250'), 1250n)
  assert.equal(toMinor(' -1250 '), -1250n)
  assert.equal(toMinor(1250), 1250n)
})

test('fractions, unsafe numbers and junk strings are refused', () => {
  assert.throws(() => toMinor(12.5), RangeError)
  assert.throws(() => toMinor(Number.MAX_SAFE_INTEGER + 2), RangeError)
  assert.throws(() => toMinor('12.50'), RangeError)
  assert.throws(() => toMinor('1e3'), RangeError)
  assert.throws(() => toMinor(''), RangeError)
})

test('sum accepts mixed shapes', () => {
  assert.equal(sumMinor([100n, '250', 50]), 400n)
  assert.equal(sumMinor([]), 0n)
})

test('floor division rounds toward negative infinity', () => {
  assert.equal(floorDiv(7n, 2n), 3n)
  assert.equal(floorDiv(-7n, 2n), -4n)
  assert.equal(floorDiv(-8n, 2n), -4n)
  assert.equal(floorDiv(7n, -2n), -4n)
  assert.throws(() => floorDiv(1n, 0n), RangeError)
})

test('half-even division rounds ties to the even neighbour and is symmetric', () => {
  assert.equal(divideHalfEven(25n, 2n), 12n)
  assert.equal(divideHalfEven(35n, 2n), 18n)
  assert.equal(divideHalfEven(26n, 2n), 13n)
  assert.equal(divideHalfEven(27n, 2n), 14n)
  assert.equal(divideHalfEven(-25n, 2n), -12n)
  assert.equal(divideHalfEven(-35n, 2n), -18n)
  assert.equal(divideHalfEven(10n, 3n), 3n)
  assert.equal(divideHalfEven(20n, 3n), 7n)
  assert.throws(() => divideHalfEven(1n, 0n), RangeError)
})

test('powers of ten are exact bigints', () => {
  assert.equal(pow10(0), 1n)
  assert.equal(pow10(10), 10_000_000_000n)
  assert.throws(() => pow10(-1), RangeError)
})
