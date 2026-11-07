import type { EmergencyRecord, SyncRowMap, SyncTable } from './records'

/**
 * A pulled row for one the device has changed and not yet synced: the
 * server's row wins everywhere except on the fields a pending mutation
 * still carries, which keep the device's value (they will reach the server
 * or lose there, where the next pull settles them). The row stays
 * `pending`. For emergency information the fields are the top-level keys
 * of `content` (the server merges them per key as well). Pure.
 */
export function mergePendingRow<T extends SyncTable>(
  table: T,
  local: SyncRowMap[T],
  server: SyncRowMap[T],
  pendingFields: ReadonlySet<string>
): SyncRowMap[T] {
  if (table === 'emergency') {
    const mine = local as EmergencyRecord
    const theirs = server as EmergencyRecord
    const content = { ...theirs.content }
    for (const key of pendingFields) {
      if (key in mine.content) {
        Object.assign(content, { [key]: mine.content[key as keyof typeof mine.content] })
      }
    }
    return { ...theirs, content, syncState: 'pending' } as SyncRowMap[T]
  }
  const merged: Record<string, unknown> = { ...server }
  const ours = local as unknown as Record<string, unknown>
  for (const field of pendingFields) {
    if (field in ours) {
      merged[field] = ours[field]
    }
  }
  return { ...merged, syncState: 'pending' } as SyncRowMap[T]
}
