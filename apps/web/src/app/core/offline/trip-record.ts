import type { Trip, TripListItem } from '@monkitrips/shared'
import type { TripRecord } from './records'

/**
 * The device's row for a trip the API returned. Pure. A list item carries
 * the person's role; a plain trip keeps the role the row already had.
 */
export function toTripRecord(trip: Trip | TripListItem, previous?: TripRecord): TripRecord {
  const role = 'role' in trip ? trip.role : previous?.role
  return {
    id: trip.id,
    name: trip.name,
    startDate: trip.startsOn,
    endDate: trip.endsOn,
    baseCurrency: trip.baseCurrency,
    budgetMode: trip.budgetMode,
    budgetTotalMinor: trip.budgetTotalMinor,
    homeTz: trip.homeTz,
    ...(role ? { role } : {}),
    updatedAt: trip.updatedAt,
  }
}

/**
 * The trip row after a local edit of its wire fields (`name`, `startsOn`,
 * `endsOn`, `baseCurrency`, `budgetMode`, `budgetTotalMinor`, `homeTz`),
 * the shape a `trip` mutation carries. Pure.
 */
export function applyTripChanges(
  record: TripRecord,
  changes: Record<string, unknown>,
  updatedAt: string
): TripRecord {
  const next: TripRecord = { ...record, updatedAt }
  if (typeof changes['name'] === 'string') next.name = changes['name']
  if (typeof changes['startsOn'] === 'string') next.startDate = changes['startsOn']
  if (typeof changes['endsOn'] === 'string') next.endDate = changes['endsOn']
  if (typeof changes['baseCurrency'] === 'string') next.baseCurrency = changes['baseCurrency']
  if (typeof changes['budgetMode'] === 'string') next.budgetMode = changes['budgetMode']
  if ('budgetTotalMinor' in changes) {
    const value = changes['budgetTotalMinor']
    next.budgetTotalMinor = typeof value === 'number' ? value : null
  }
  if (typeof changes['homeTz'] === 'string') next.homeTz = changes['homeTz']
  return next
}
