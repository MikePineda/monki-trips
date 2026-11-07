/**
 * Field-level last-write-wins. Every syncable row carries a
 * `fieldClock` (`{ field: epochMs }`): the time the person made the change
 * that set each field. A mutation applies a field when its `changedAt` is
 * not older than the field's clock; a tie goes to the mutation that arrives
 * last. A deleted row is a tombstone and wins over every later edit.
 *
 * Pure: the caller clamps `changedAt` (see `clampChangedAt`) and persists
 * the result. Mirrors the shared `lww_merge` of the domain package.
 */

export type FieldClock = Record<string, number>

export interface LwwMergeInput {
  /** The row as stored, or null when the mutation creates it. */
  current: Record<string, unknown> | null
  /** True when the stored row is a tombstone. */
  deleted: boolean
  clock: FieldClock
  /** The fields the client changed, already validated. */
  changes: Record<string, unknown>
  /** When the person made the change, epoch ms, clamped. */
  changedAt: number
}

export type LwwMergeResult =
  | { outcome: 'deleted' }
  | {
      outcome: 'merged'
      /** Fields that won and must be written. */
      applied: Record<string, unknown>
      /** Fields that lost against a newer stored change. */
      rejectedFields: string[]
      /** The clock after the merge. */
      clock: FieldClock
    }

export function lwwMerge(input: LwwMergeInput): LwwMergeResult {
  if (input.deleted) return { outcome: 'deleted' }
  const applied: Record<string, unknown> = {}
  const rejectedFields: string[] = []
  const clock: FieldClock = { ...input.clock }
  for (const [field, value] of Object.entries(input.changes)) {
    const since = input.current ? (input.clock[field] ?? 0) : 0
    if (input.changedAt >= since) {
      applied[field] = value
      clock[field] = input.changedAt
    } else {
      rejectedFields.push(field)
    }
  }
  return { outcome: 'merged', applied, rejectedFields, clock }
}

/**
 * Clamps a client's `changedAt` to `[now - windowDays, now]`: a device with
 * a skewed clock can neither back-date a change beyond the window nor claim
 * it happened in the future.
 */
export function clampChangedAt(changedAt: number, now: number, windowDays: number): number {
  const floor = now - windowDays * 24 * 60 * 60 * 1000
  return Math.min(now, Math.max(floor, changedAt))
}
