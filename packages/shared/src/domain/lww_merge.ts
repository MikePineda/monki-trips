/**
 * Field-level last-write-wins, the merge behind `POST /sync/push`. Every
 * row carries a `fieldClock` (`{ field: epochMs }`), every mutation a
 * `changedAt` clamped to `[now − 45 days, now]`. A field applies when
 * `changedAt >= clock[field]`; on a tie the last to arrive wins. A tombstone
 * always wins: deleting ignores clocks, and an upsert on a deleted row is
 * rejected with `E_ROW_DELETED`. Derived fields (`*_at`, `starts_on`,
 * `base_amount_minor`, start and end from segments) are never accepted
 * from the client; the caller recomputes them after the merge.
 */
import type { IsoInstant } from './zoned_instant.ts'

export const LWW_MAX_AGE_MS = 45 * 86_400_000

export type FieldClock = Record<string, number>

export interface LwwRow {
  fields: Record<string, unknown>
  fieldClock: FieldClock
  deletedAt: IsoInstant | null
}

export type LwwOp = 'upsert' | 'delete'

export interface LwwMutation {
  op: LwwOp
  changes: Record<string, unknown>
  /** Client clock of the change, epoch milliseconds. */
  changedAt: number
}

export type LwwStatus = 'applied' | 'partial' | 'rejected'

export type LwwRejection = 'older' | 'derived' | 'deleted'

export interface LwwResult {
  status: LwwStatus
  row: LwwRow
  appliedFields: string[]
  rejectedFields: string[]
  rejectedReasons: Record<string, LwwRejection>
  /** The `changedAt` actually used, after clamping. */
  changedAt: number
  error: 'E_ROW_DELETED' | null
}

export interface LwwOptions {
  /** Fields the server derives; a client value for them is dropped. */
  derivedFields?: readonly string[]
}

/** Keeps a client clock inside `[now − 45 days, now]`. */
export function clampChangedAt(changedAt: number, nowMs: number): number {
  if (!Number.isFinite(changedAt)) {
    return nowMs
  }
  return Math.min(nowMs, Math.max(nowMs - LWW_MAX_AGE_MS, changedAt))
}

const EMPTY_ROW: LwwRow = { fields: {}, fieldClock: {}, deletedAt: null }

export function lwwMerge(
  current: LwwRow | null,
  mutation: LwwMutation,
  nowMs: number,
  options: LwwOptions = {}
): LwwResult {
  const base = current ?? EMPTY_ROW
  const changedAt = clampChangedAt(mutation.changedAt, nowMs)
  const fieldNames = Object.keys(mutation.changes)

  if (mutation.op === 'delete') {
    return {
      status: 'applied',
      row: {
        fields: { ...base.fields },
        fieldClock: { ...base.fieldClock },
        deletedAt: base.deletedAt ?? new Date(nowMs).toISOString(),
      },
      appliedFields: [],
      rejectedFields: [],
      rejectedReasons: {},
      changedAt,
      error: null,
    }
  }

  if (base.deletedAt) {
    return {
      status: 'rejected',
      row: {
        fields: { ...base.fields },
        fieldClock: { ...base.fieldClock },
        deletedAt: base.deletedAt,
      },
      appliedFields: [],
      rejectedFields: fieldNames,
      rejectedReasons: Object.fromEntries(fieldNames.map((field) => [field, 'deleted' as const])),
      changedAt,
      error: 'E_ROW_DELETED',
    }
  }

  const derived = new Set(options.derivedFields ?? [])
  const fields = { ...base.fields }
  const fieldClock = { ...base.fieldClock }
  const appliedFields: string[] = []
  const rejectedFields: string[] = []
  const rejectedReasons: Record<string, LwwRejection> = {}
  for (const field of fieldNames) {
    if (derived.has(field)) {
      rejectedFields.push(field)
      rejectedReasons[field] = 'derived'
      continue
    }
    const known = fieldClock[field]
    if (known !== undefined && changedAt < known) {
      rejectedFields.push(field)
      rejectedReasons[field] = 'older'
      continue
    }
    fields[field] = mutation.changes[field]
    fieldClock[field] = changedAt
    appliedFields.push(field)
  }

  const status: LwwStatus =
    rejectedFields.length === 0 ? 'applied' : appliedFields.length === 0 ? 'rejected' : 'partial'
  return {
    status,
    row: { fields, fieldClock, deletedAt: null },
    appliedFields,
    rejectedFields,
    rejectedReasons,
    changedAt,
    error: null,
  }
}
