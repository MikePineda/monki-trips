import { test } from '@japa/runner'
import { zoneOffsetAt } from '#domain/zone_offset'

test.group('Zone offset', () => {
  test('the offset of a zone follows its daylight saving changes', ({ assert }) => {
    // Europe/Madrid moves from +60 to +120 at 2027-03-28T01:00Z.
    assert.equal(zoneOffsetAt('Europe/Madrid', '2027-03-28T00:59:00.000Z'), 60)
    assert.equal(zoneOffsetAt('Europe/Madrid', '2027-03-28T01:00:00.000Z'), 120)
    assert.equal(zoneOffsetAt('Asia/Kathmandu', '2027-01-01T00:00:00.000Z'), 345)
    assert.equal(zoneOffsetAt('America/New_York', '2027-01-01T00:00:00.000Z'), -300)
  })

  test('an unknown zone reads as UTC', ({ assert }) => {
    assert.equal(zoneOffsetAt('Nowhere/Zone', '2027-01-01T00:00:00.000Z'), 0)
  })
})
