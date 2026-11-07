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

const DECIMAL = /^\d+$/

export function encodeSyncCursor(cursor: SyncCursor): string {
  const parts = [cursor.xid, cursor.seq, String(cursor.issuedAt)]
  if (cursor.snapshotAfter) parts.push(cursor.snapshotAfter.xid, cursor.snapshotAfter.seq)
  return Buffer.from(parts.join(':'), 'utf8').toString('base64url')
}

/** The cursor behind an opaque string, or null when it is not one of ours. */
export function decodeSyncCursor(value: string): SyncCursor | null {
  let text: string
  try {
    text = Buffer.from(value, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const parts = text.split(':')
  if (parts.length !== 3 && parts.length !== 5) return null
  if (!parts.every((part) => DECIMAL.test(part))) return null
  const [xid, seq, issued, snapshotXid, snapshotSeq] = parts
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
