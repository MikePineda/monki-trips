import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The opaque pull cursor: where the client is in the global change order.
 * It carries the `(change_xid, change_seq)` of the last row delivered and
 * the instant it was issued, so a cursor older than the purge horizon can
 * be refused before any tombstone it never saw has been purged. xid8 values
 * arrive from Postgres as decimal strings and go back the same way.
 *
 * While the snapshot of a trip the person joined after the cursor is being
 * paged, `snapshotAfter` holds the last stamp of that snapshot delivered:
 * the snapshot rows sort before the cursor itself.
 *
 * The text is `base64url(body).base64url(HMAC-SHA256(secret, body))`: a
 * cursor the server did not issue (edited, unsigned, signed with another
 * key) decodes to null, and so does one whose stamps do not fit a bigint,
 * so the queries never see a value they cannot cast.
 */

export interface SyncCursor {
  /** `change_xid` as a decimal string (xid8 exceeds the safe integer range). */
  xid: string
  /** `change_seq` as a decimal string (bigint). */
  seq: string
  /** When the cursor was issued, epoch ms. */
  issuedAt: number
  /** Where a paged snapshot of newly joined trips resumes, when one is in progress. */
  snapshotAfter?: { xid: string; seq: string }
}

const DECIMAL = /^\d{1,20}$/
/** 2^63 − 1: the largest `bigint`, and far above any xid8 Postgres hands out. */
const MAX_STAMP = 9_223_372_036_854_775_807n

function signatureOf(body: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(body).digest()
}

export function encodeSyncCursor(cursor: SyncCursor, secret: string): string {
  const parts = [cursor.xid, cursor.seq, String(cursor.issuedAt)]
  if (cursor.snapshotAfter) parts.push(cursor.snapshotAfter.xid, cursor.snapshotAfter.seq)
  const body = parts.join(':')
  const signature = signatureOf(body, secret).toString('base64url')
  return `${Buffer.from(body, 'utf8').toString('base64url')}.${signature}`
}

/** The cursor behind an opaque string, or null when it is not one we issued. */
export function decodeSyncCursor(value: string, secret: string): SyncCursor | null {
  const pieces = value.split('.')
  if (pieces.length !== 2) return null
  const [encodedBody, encodedSignature] = pieces
  const body = Buffer.from(encodedBody, 'base64url').toString('utf8')
  const signature = Buffer.from(encodedSignature, 'base64url')
  const expected = signatureOf(body, secret)
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null

  const parts = body.split(':')
  if (parts.length !== 3 && parts.length !== 5) return null
  if (!parts.every((part) => DECIMAL.test(part))) return null
  const [xid, seq, issued, snapshotXid, snapshotSeq] = parts
  const stamps = snapshotXid === undefined ? [xid, seq] : [xid, seq, snapshotXid, snapshotSeq]
  if (stamps.some((stamp) => BigInt(stamp) > MAX_STAMP)) return null
  const issuedAt = Number(issued)
  if (!Number.isSafeInteger(issuedAt)) return null
  const cursor: SyncCursor = { xid, seq, issuedAt }
  if (snapshotXid !== undefined) cursor.snapshotAfter = { xid: snapshotXid, seq: snapshotSeq }
  return cursor
}

/** Whether the cursor was issued before `now - horizonDays`: tombstones it missed may be gone. */
export function isCursorExpired(cursor: SyncCursor, now: number, horizonDays: number): boolean {
  return cursor.issuedAt < now - horizonDays * 24 * 60 * 60 * 1000
}
