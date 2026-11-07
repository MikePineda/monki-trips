/**
 * The opaque pull cursor: where the client is in the global change order.
 * It carries the `(change_xid, change_seq)` of the last row delivered and
 * the instant it was issued, so a cursor older than the purge horizon can
 * be refused before any tombstone it never saw has been purged. xid8 values
 * arrive from Postgres as decimal strings and go back the same way.
 */

export interface SyncCursor {
  /** `change_xid` as a decimal string (xid8 exceeds the safe integer range). */
  xid: string
  /** `change_seq` as a decimal string (bigint). */
  seq: string
  /** When the cursor was issued, epoch ms. */
  issuedAt: number
}

const DECIMAL = /^\d+$/

export function encodeSyncCursor(cursor: SyncCursor): string {
  return Buffer.from(`${cursor.xid}:${cursor.seq}:${cursor.issuedAt}`, 'utf8').toString('base64url')
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
  if (parts.length !== 3 || !parts.every((part) => DECIMAL.test(part))) return null
  const [xid, seq, issued] = parts
  const issuedAt = Number(issued)
  if (!Number.isSafeInteger(issuedAt)) return null
  return { xid, seq, issuedAt }
}

/** Whether the cursor was issued before `now - horizonDays`: tombstones it missed may be gone. */
export function isCursorExpired(cursor: SyncCursor, now: number, horizonDays: number): boolean {
  return cursor.issuedAt < now - horizonDays * 24 * 60 * 60 * 1000
}
