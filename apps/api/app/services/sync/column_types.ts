import { DateTime } from 'luxon'
import { parseIsoInstant } from '#domain/iso_instant'

/**
 * How a database value becomes a wire value and back. Postgres (through
 * `pg`) returns bigint and numeric as strings, `date` and `timestamp
 * without time zone` as JS Dates built in the process zone, timestamptz as
 * Dates, arrays and jsonb as JS values. The wire speaks numbers for minor
 * units and coordinates, decimal strings for rates, `YYYY-MM-DD` for dates,
 * `YYYY-MM-DDTHH:mm:ss` for local times and ISO UTC for instants.
 */
export type ColumnType =
  | 'text'
  | 'int'
  | 'decimal'
  | 'decimalString'
  | 'bool'
  | 'date'
  | 'localTime'
  | 'instant'
  | 'json'
  | 'textArray'

/** Trailing zeros of a Postgres numeric (`22.5000000000`) are noise on the wire. */
export function normalizeDecimalString(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * A `date` or `timestamp` value as pg returns it, back to the wall-clock
 * text it was stored as. Text (timestamps, see `config/database.ts`) is read
 * as UTC so no zone, and no daylight-saving gap of one, can move it; a
 * `date` still arrives as a Date at local midnight and is read in that zone.
 */
function wallClock(value: unknown): DateTime | null {
  if (value instanceof Date) return DateTime.fromJSDate(value)
  if (typeof value === 'string') return DateTime.fromISO(value.replace(' ', 'T'), { zone: 'utc' })
  return null
}

export function toWireValue(type: ColumnType, value: unknown): unknown {
  if (value === null || value === undefined) return null
  switch (type) {
    case 'text':
      return String(value)
    case 'int':
      return Number(value)
    case 'decimal':
      return Number(value)
    case 'decimalString':
      return normalizeDecimalString(String(value))
    case 'bool':
      return Boolean(value)
    case 'date':
      return wallClock(value)?.toISODate() ?? null
    case 'localTime':
      return wallClock(value)?.toFormat("yyyy-MM-dd'T'HH:mm:ss") ?? null
    case 'instant':
      return value instanceof Date
        ? value.toISOString()
        : DateTime.fromISO(String(value)).toUTC().toISO()
    case 'json':
      return value
    case 'textArray':
      return Array.isArray(value) ? value : []
  }
}

/** A validated wire value as the column accepts it. */
export function toColumnValue(type: ColumnType, value: unknown): unknown {
  if (value === null || value === undefined) return null
  switch (type) {
    case 'json':
      return JSON.stringify(value)
    case 'instant':
      return parseIsoInstant(String(value))
    default:
      return value
  }
}
