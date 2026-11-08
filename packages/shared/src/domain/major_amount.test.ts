import { test } from 'node:test'
import assert from 'node:assert/strict'
import { majorAmountToMinor } from './major_amount.ts'

test('three hundred fifty baht is thirty five thousand satang', () => {
  assert.equal(majorAmountToMinor('350', 'THB'), 35000n)
})

test('decimals fill the currency exponent', () => {
  assert.equal(majorAmountToMinor('12.5', 'EUR'), 1250n)
  assert.equal(majorAmountToMinor('0.75', 'AUD'), 75n)
  assert.equal(majorAmountToMinor('1.234', 'KWD'), 1234n)
})

test('zero-decimal JPY refuses a fraction', () => {
  assert.equal(majorAmountToMinor('1200', 'JPY'), 1200n)
  assert.equal(majorAmountToMinor('1200.5', 'JPY'), null)
})

test('more decimals than the currency has is refused, never rounded', () => {
  assert.equal(majorAmountToMinor('3.505', 'EUR'), null)
})

test('a negative amount is a refund', () => {
  assert.equal(majorAmountToMinor('-20', 'EUR'), -2000n)
})

test('anything that is not a plain decimal is refused', () => {
  for (const value of ['', ' ', '1e3', '1,000', 'abc', '12.', '.5', '--1']) {
    assert.equal(majorAmountToMinor(value, 'EUR'), null, value)
  }
})
