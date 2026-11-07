import { DateTime } from 'luxon'

/**
 * Reads an ISO 8601 instant the one way the whole API does: with Luxon,
 * which accepts every ISO form (calendar, ordinal and week dates, with or
 * without seconds and offset). A value without an offset is read as UTC,
 * never in the process zone. `Date.parse` is not used anywhere for client
 * input: it rejects forms the validators accept (`2026-W45-6`) and would
 * turn them into `NaN`.
 */
export function parseIsoInstant(value: string): Date | null {
  const parsed = DateTime.fromISO(value.trim(), { zone: 'utc' })
  return parsed.isValid ? parsed.toJSDate() : null
}
