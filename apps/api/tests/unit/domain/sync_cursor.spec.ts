import { test } from '@japa/runner'
import { decodeSyncCursor, encodeSyncCursor, isCursorExpired } from '#domain/sync_cursor'

const DAY = 24 * 60 * 60 * 1000

test.group('Sync cursor', () => {
  test('round trips the transaction id, sequence and issue time', ({ assert }) => {
    const cursor = { xid: '18446744073709551615', seq: '42', issuedAt: 1_800_000_000_000 }

    const encoded = encodeSyncCursor(cursor)

    assert.notInclude(encoded, ':')
    assert.deepEqual(decodeSyncCursor(encoded), cursor)
  })

  test('garbage is not a cursor', ({ assert }) => {
    assert.isNull(decodeSyncCursor('not-a-cursor'))
    assert.isNull(decodeSyncCursor(Buffer.from('1:2').toString('base64url')))
    assert.isNull(decodeSyncCursor(Buffer.from('a:b:c').toString('base64url')))
  })

  test('a cursor issued before the purge horizon is expired', ({ assert }) => {
    const now = 1_800_000_000_000

    assert.isTrue(isCursorExpired({ xid: '1', seq: '1', issuedAt: now - 91 * DAY }, now, 90))
    assert.isFalse(isCursorExpired({ xid: '1', seq: '1', issuedAt: now - 89 * DAY }, now, 90))
  })
})
