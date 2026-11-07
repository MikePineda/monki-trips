import { test } from '@japa/runner'
import { convertToBaseMinor, divideHalfEven } from '#domain/convert_to_base'

test.group('Convert to base', () => {
  test('converts foreign minor to base minor with half-even rounding', ({ assert }) => {
    // 1 AUD = 22.5 THB; 450.00 THB = 20.00 AUD
    assert.equal(
      convertToBaseMinor({ amountMinor: 45000, rate: '22.5', fromExponent: 2, toExponent: 2 }),
      2000n
    )
    // 1.125 base minor rounds to 1.12 (even) and 1.135 to 1.14: 25 THB at 22.5 → 1.111.. AUD
    assert.equal(
      convertToBaseMinor({ amountMinor: 2500, rate: '22.5', fromExponent: 2, toExponent: 2 }),
      111n
    )
  })

  test('converts zero-decimal JPY', ({ assert }) => {
    // 1 AUD = 95 JPY; 1900 JPY = 20.00 AUD
    assert.equal(
      convertToBaseMinor({ amountMinor: 1900, rate: '95', fromExponent: 0, toExponent: 2 }),
      2000n
    )
  })

  test('identity rate for base currency', ({ assert }) => {
    assert.equal(
      convertToBaseMinor({ amountMinor: 1234, rate: '1', fromExponent: 2, toExponent: 2 }),
      1234n
    )
  })

  test('a three-decimal base currency and a rate with ten decimals', ({ assert }) => {
    // 1 KWD = 3.2553011234 USD; 100.00 USD = 30.719 KWD
    assert.equal(
      convertToBaseMinor({
        amountMinor: 10000,
        rate: '3.2553011234',
        fromExponent: 2,
        toExponent: 3,
      }),
      30719n
    )
  })

  test('a refund stays negative and rounds symmetrically', ({ assert }) => {
    assert.equal(
      convertToBaseMinor({ amountMinor: -2500, rate: '22.5', fromExponent: 2, toExponent: 2 }),
      -111n
    )
  })

  test('half-even rounds ties to the even neighbour', ({ assert }) => {
    assert.equal(divideHalfEven(25n, 10n), 2n)
    assert.equal(divideHalfEven(35n, 10n), 4n)
    assert.equal(divideHalfEven(36n, 10n), 4n)
    assert.equal(divideHalfEven(-25n, 10n), -2n)
  })

  test('a zero or malformed rate is refused', ({ assert }) => {
    assert.throws(() =>
      convertToBaseMinor({ amountMinor: 1, rate: '0', fromExponent: 2, toExponent: 2 })
    )
    assert.throws(() =>
      convertToBaseMinor({ amountMinor: 1, rate: '-1.5', fromExponent: 2, toExponent: 2 })
    )
  })
})
