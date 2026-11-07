import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertToBase, parseDecimal } from './convert_to_base.ts'

test('converts THB minor to AUD minor with half-even rounding', () => {
  // 2 THB per AUD: 0.25 THB is exactly 0.125 AUD → 12 (even), 0.35 THB is 0.175 → 18 (even).
  assert.equal(
    convertToBase({ amountMinor: 25n, currency: 'THB', baseCurrency: 'AUD', rate: '2' }),
    12n
  )
  assert.equal(
    convertToBase({ amountMinor: 35n, currency: 'THB', baseCurrency: 'AUD', rate: '2' }),
    18n
  )
  // 10.00 THB at 23.5 THB per AUD is 0.4255… AUD → 43.
  assert.equal(
    convertToBase({ amountMinor: '1000', currency: 'THB', baseCurrency: 'AUD', rate: '23.5' }),
    43n
  )
})

test('converts zero-decimal JPY', () => {
  // 1000 JPY at 100 JPY per AUD is 10.00 AUD → 1000 minor.
  assert.equal(
    convertToBase({ amountMinor: 1000, currency: 'JPY', baseCurrency: 'AUD', rate: '100' }),
    1000n
  )
  // And back: 12.50 AUD at 0.01 AUD per JPY is 1250 JPY.
  assert.equal(
    convertToBase({ amountMinor: 1250n, currency: 'AUD', baseCurrency: 'JPY', rate: '0.01' }),
    1250n
  )
})

test('identity rate for base currency', () => {
  assert.equal(
    convertToBase({ amountMinor: 123_456n, currency: 'AUD', baseCurrency: 'AUD', rate: '1' }),
    123_456n
  )
  assert.equal(
    convertToBase({
      amountMinor: -99n,
      currency: 'EUR',
      baseCurrency: 'EUR',
      rate: '1.0000000000',
    }),
    -99n
  )
})

test('three-decimal currency converts through its own exponent', () => {
  // 0.300 KWD at 0.3 KWD per EUR is exactly 1.00 EUR.
  assert.equal(
    convertToBase({ amountMinor: 300n, currency: 'KWD', baseCurrency: 'EUR', rate: '0.3' }),
    100n
  )
  // 0.305 KWD is 1.0166… EUR → 102.
  assert.equal(
    convertToBase({ amountMinor: 305n, currency: 'KWD', baseCurrency: 'EUR', rate: '0.3' }),
    102n
  )
})

test('a rate with ten decimals is used exactly', () => {
  // 10.00 THB / 23.1234567891 = 0.43246… AUD → 43.
  assert.equal(
    convertToBase({
      amountMinor: 1000n,
      currency: 'THB',
      baseCurrency: 'AUD',
      rate: '23.1234567891',
    }),
    43n
  )
  // A tiny rate with a long tail: 1 minor / 0.0000000001 → 10^10 minor.
  assert.equal(
    convertToBase({ amountMinor: 1n, currency: 'USD', baseCurrency: 'EUR', rate: '0.0000000001' }),
    10_000_000_000n
  )
})

test('negative refunds round symmetrically', () => {
  assert.equal(
    convertToBase({ amountMinor: -25n, currency: 'THB', baseCurrency: 'AUD', rate: '2' }),
    -12n
  )
  assert.equal(
    convertToBase({ amountMinor: -35n, currency: 'THB', baseCurrency: 'AUD', rate: '2' }),
    -18n
  )
  assert.equal(
    convertToBase({ amountMinor: -1000n, currency: 'THB', baseCurrency: 'AUD', rate: '23.5' }),
    -43n
  )
})

test('a zero, negative or malformed rate is refused', () => {
  const base = { amountMinor: 100n, currency: 'THB', baseCurrency: 'AUD' }
  assert.throws(() => convertToBase({ ...base, rate: '0' }), RangeError)
  assert.throws(() => convertToBase({ ...base, rate: '0.0' }), RangeError)
  assert.throws(() => convertToBase({ ...base, rate: '-2' }), RangeError)
  assert.throws(() => convertToBase({ ...base, rate: '2,5' }), RangeError)
  assert.throws(() => convertToBase({ ...base, rate: '1e3' }), RangeError)
  assert.throws(() => convertToBase({ ...base, rate: '' }), RangeError)
})

test('decimal strings are parsed exactly, without floating point', () => {
  assert.deepEqual(parseDecimal('23.1234567891'), { digits: 231_234_567_891n, scale: 10 })
  assert.deepEqual(parseDecimal('100'), { digits: 100n, scale: 0 })
  assert.deepEqual(parseDecimal(' 0.5 '), { digits: 5n, scale: 1 })
})
