import { test } from 'node:test'
import assert from 'node:assert/strict'
import { minorUnitExponent } from './currency_exponent.ts'

test('JPY has zero decimals', () => {
  assert.deepEqual(minorUnitExponent('JPY'), { exponent: 0, known: true })
})

test('KWD has three decimals', () => {
  assert.deepEqual(minorUnitExponent('KWD'), { exponent: 3, known: true })
})

test('THB has two decimals', () => {
  assert.deepEqual(minorUnitExponent('THB'), { exponent: 2, known: true })
})

test('unknown code defaults to two and is flagged', () => {
  assert.deepEqual(minorUnitExponent('ZZZ'), { exponent: 2, known: false })
})

test('codes are matched case-insensitively and trimmed', () => {
  assert.deepEqual(minorUnitExponent(' jpy '), { exponent: 0, known: true })
})

test('a malformed code is unknown, never a crash', () => {
  assert.deepEqual(minorUnitExponent(''), { exponent: 2, known: false })
  assert.deepEqual(minorUnitExponent('JPYY'), { exponent: 2, known: false })
})
