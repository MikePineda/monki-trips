import type { ColumnSpec, DbRow, EntitySpec, MergedRow } from '#services/sync/entity_spec'
import { toColumnValue, toWireValue } from '#services/sync/column_types'

/** A database row of an entity in its wire shape (camelCase, wire value types). */
export function rowToWire(spec: EntitySpec, row: DbRow): Record<string, unknown> {
  const wire: Record<string, unknown> = {}
  for (const column of spec.columns) {
    // Virtual columns (`content.<key>`) live inside a json column, not on the wire by themselves.
    if (column.column.includes('.')) continue
    wire[column.field] = toWireValue(column.type, row[column.column])
  }
  return wire
}

/** Validated wire changes as the columns to write (snake_case, column value types). */
export function wireToColumns(
  columns: Map<string, ColumnSpec>,
  changes: Record<string, unknown>
): DbRow {
  const values: DbRow = {}
  for (const [field, value] of Object.entries(changes)) {
    const column = columns.get(field)
    if (!column) continue
    values[column.column] = toColumnValue(column.type, value)
  }
  return values
}

/** The merged view of a row (wire names and values) after `changes` are applied on top of it. */
export function mergedWire(
  spec: EntitySpec,
  current: DbRow | null,
  applied: Record<string, unknown>
): MergedRow {
  const base = current ? rowToWire(spec, current) : {}
  return { ...base, ...applied }
}
