import { test } from '@japa/runner'
import { Settings } from 'luxon'
import { parseIsoInstant } from '#domain/iso_instant'

test.group('ISO instant', () => {
  test('reads every ISO 8601 form the validators accept', ({ assert }) => {
    assert.equal(
      parseIsoInstant('2026-11-07T10:00:00.000Z')?.toISOString(),
      '2026-11-07T10:00:00.000Z'
    )
    assert.equal(
      parseIsoInstant('2026-11-07T21:00+11:00')?.toISOString(),
      '2026-11-07T10:00:00.000Z'
    )
    assert.equal(parseIsoInstant('2026-W45-6')?.toISOString(), '2026-11-07T00:00:00.000Z')
    assert.equal(parseIsoInstant('2026-311')?.toISOString(), '2026-11-07T00:00:00.000Z')
  })

  test('a value without an offset is UTC whatever the process zone', ({ assert }) => {
    const zone = Settings.defaultZone
    Settings.defaultZone = 'America/New_York'
    try {
      assert.equal(parseIsoInstant('2026-11-07T10:00')?.toISOString(), '2026-11-07T10:00:00.000Z')
    } finally {
      Settings.defaultZone = zone
    }
  })

  test('anything else is not an instant', ({ assert }) => {
    assert.isNull(parseIsoInstant('yesterday'))
    assert.isNull(parseIsoInstant('2026-02-30T10:00:00Z'))
    assert.isNull(parseIsoInstant(''))
  })
})
