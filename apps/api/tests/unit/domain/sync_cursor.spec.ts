import { test } from '@japa/runner'
import { decodeSyncCursor, encodeSyncCursor, isCursorExpired } from '#domain/sync_cursor'

const DAY = 24 * 60 * 60 * 1000
const KEY = 'unit-test-key-of-at-least-32-chars!'

test.group('Sync cursor', () => {
  test('round trips the transaction id, sequence and issue time', ({ assert }) => {
    const cursor = { xid: '9223372036854775807', seq: '42', issuedAt: 1_800_000_000_000 }

    const encoded = encodeSyncCursor(cursor, KEY)

    assert.notInclude(encoded, ':')
    assert.deepEqual(decodeSyncCursor(encoded, KEY), cursor)
  })

  test('round trips the resume point of a snapshot in progress', ({ assert }) => {
    const cursor = {
      xid: '900',
      seq: '42',
      issuedAt: 1_800_000_000_000,
      snapshotAfter: { xid: '700', seq: '7' },
    }

    assert.deepEqual(decodeSyncCursor(encodeSyncCursor(cursor, KEY), KEY), cursor)
  })

  test('garbage is not a cursor', ({ assert }) => {
    assert.isNull(decodeSyncCursor('not-a-cursor', KEY))
    assert.isNull(decodeSyncCursor(Buffer.from('1:2').toString('base64url'), KEY))
    assert.isNull(decodeSyncCursor(Buffer.from('a:b:c').toString('base64url'), KEY))
  })

  test('a tampered, unsigned or foreign cursor is not a cursor', ({ assert }) => {
    const genuine = encodeSyncCursor({ xid: '900', seq: '42', issuedAt: 1_800_000_000_000 }, KEY)
    const [, signature] = genuine.split('.')
    const forged = `${Buffer.from('901:42:1800000000000').toString('base64url')}.${signature}`

    assert.isNull(decodeSyncCursor(forged, KEY))
    assert.isNull(decodeSyncCursor(Buffer.from('900:42:1800000000000').toString('base64url'), KEY))
    assert.isNull(decodeSyncCursor(genuine, 'another-key-of-at-least-32-chars!!'))
    assert.isNull(decodeSyncCursor(`${genuine}.extra`, KEY))
  })

  test('a stamp beyond the bigint range is not a cursor', ({ assert }) => {
    const maxBigint = '9223372036854775807'
    const valid = encodeSyncCursor({ xid: maxBigint, seq: maxBigint, issuedAt: 1 }, KEY)

    assert.isNotNull(decodeSyncCursor(valid, KEY))
    for (const body of [
      '9223372036854775808:1:1',
      '1:9223372036854775808:1',
      '1:1:1:99999999999999999999:1',
      '1:1:1:1:9223372036854775808',
    ]) {
      // Signed correctly, so only the range check can refuse it.
      assert.isNull(decodeSyncCursor(signedBody(body), KEY), body)
    }
  })

  test('a cursor issued before the purge horizon is expired', ({ assert }) => {
    const now = 1_800_000_000_000

    assert.isTrue(isCursorExpired({ xid: '1', seq: '1', issuedAt: now - 91 * DAY }, now, 90))
    assert.isFalse(isCursorExpired({ xid: '1', seq: '1', issuedAt: now - 89 * DAY }, now, 90))
  })
})

/** `body` signed the way the encoder signs, through the public encoder only. */
function signedBody(body: string): string {
  const [xid, seq, issuedAt, snapshotXid, snapshotSeq] = body.split(':')
  return encodeSyncCursor(
    {
      xid,
      seq,
      issuedAt: Number(issuedAt),
      ...(snapshotXid ? { snapshotAfter: { xid: snapshotXid, seq: snapshotSeq } } : {}),
    },
    KEY
  )
}
