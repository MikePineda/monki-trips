import { test } from '@japa/runner'
import { localTimeToInstant } from '#domain/local_time'

test.group('Local time to instant', () => {
  test('derives the utc instant from a local time and its zone', ({ assert }) => {
    const result = localTimeToInstant('2027-01-21T09:30', 'Australia/Sydney')

    assert.deepEqual(result, {
      ok: true,
      at: '2027-01-20T22:30:00.000Z',
      on: '2027-01-21',
      local: '2027-01-21T09:30:00',
    })
  })

  test('a nonexistent local time in a daylight saving gap is rejected', ({ assert }) => {
    // Clocks in New York jump from 02:00 to 03:00 on 2026-03-08.
    const result = localTimeToInstant('2026-03-08T02:30', 'America/New_York')

    assert.deepEqual(result, { ok: false, reason: 'nonexistent' })
  })

  test('an ambiguous local time resolves to the earlier instant', ({ assert }) => {
    // 01:30 happens twice in New York on 2026-11-01: first at UTC-4, then at UTC-5.
    const result = localTimeToInstant('2026-11-01T01:30:00', 'America/New_York')

    assert.isTrue(result.ok)
    assert.equal(result.ok && result.at, '2026-11-01T05:30:00.000Z')
  })

  test('a time just after the gap keeps the new offset', ({ assert }) => {
    const result = localTimeToInstant('2026-03-08T03:00', 'America/New_York')

    assert.equal(result.ok && result.at, '2026-03-08T07:00:00.000Z')
  })

  test('the date line is just another zone', ({ assert }) => {
    const samoa = localTimeToInstant('2027-02-01T08:00', 'Pacific/Apia')
    const honolulu = localTimeToInstant('2027-01-31T09:00', 'Pacific/Honolulu')

    assert.equal(samoa.ok && samoa.at, honolulu.ok && honolulu.at)
    assert.equal(samoa.ok && samoa.on, '2027-02-01')
  })

  test('an unknown zone or a malformed time is an error, not a crash', ({ assert }) => {
    assert.deepEqual(localTimeToInstant('2027-01-21T09:30', 'Mars/Olympus'), {
      ok: false,
      reason: 'invalid_zone',
    })
    assert.deepEqual(localTimeToInstant('2027-01-21 09:30', 'UTC'), {
      ok: false,
      reason: 'invalid_format',
    })
    assert.deepEqual(localTimeToInstant('2027-02-30T09:30', 'UTC'), {
      ok: false,
      reason: 'invalid_format',
    })
  })
})
