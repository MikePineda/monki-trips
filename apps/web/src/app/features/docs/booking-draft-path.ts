import type { BookingDraft } from '@monkitrips/shared'

/**
 * Reading and writing one field of a booking draft by its review path
 * (`title`, `segments.0.departsLocal`, `seats.1.seat`), the same paths the
 * server flags in `review` and names in 422 errors (after `draft.`). The
 * draft is never mutated: writing copies every level it passes through.
 * An empty or blank value is written as null (the draft's "not stated").
 */
export function draftValue(draft: BookingDraft, path: string): string {
  let node: unknown = draft
  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object') {
      return ''
    }
    node = (node as Record<string, unknown>)[key]
  }
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}

export function withDraftValue(draft: BookingDraft, path: string, value: string): BookingDraft {
  const written = value.trim() === '' ? null : value
  return write(draft, path.split('.'), written) as BookingDraft
}

function write(node: unknown, keys: string[], value: string | null): unknown {
  const [key, ...rest] = keys
  if (Array.isArray(node)) {
    const index = Number(key)
    const copy = [...node]
    copy[index] = rest.length === 0 ? value : write(copy[index], rest, value)
    return copy
  }
  const record = (node ?? {}) as Record<string, unknown>
  return { ...record, [key]: rest.length === 0 ? value : write(record[key], rest, value) }
}

/** The draft path of a revise field error (`draft.segments.0.departsTz` → `segments.0.departsTz`). */
export function draftErrorPath(field: string): string {
  return field.startsWith('draft.') ? field.slice('draft.'.length) : field
}
