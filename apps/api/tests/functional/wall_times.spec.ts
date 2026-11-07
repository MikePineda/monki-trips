import { test } from '@japa/runner'
import { Settings } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { toWireValue } from '#services/sync/column_types'

/**
 * Local times (`timestamp without time zone`) are wall clocks of a named
 * zone, not instants of the server's. They must read back exactly as
 * stored whatever zone the process runs in, a daylight-saving gap of that
 * zone included.
 */
test.group('Wall times', () => {
  test('a local time reads back as stored, never through the process zone', async ({ assert }) => {
    const { rows } = await db.rawQuery(`select '2026-03-08 02:30:00'::timestamp as wall`)

    assert.strictEqual(rows[0].wall, '2026-03-08 02:30:00')
  })

  test('the wire value of a local time ignores the process zone and its gaps', ({ assert }) => {
    const zone = Settings.defaultZone
    // 02:30 does not exist in New York on 2026-03-08: a zone-aware parse would move it.
    Settings.defaultZone = 'America/New_York'
    try {
      assert.equal(toWireValue('localTime', '2026-03-08 02:30:00'), '2026-03-08T02:30:00')
      assert.equal(toWireValue('date', '2026-03-08'), '2026-03-08')
    } finally {
      Settings.defaultZone = zone
    }
  })
})
