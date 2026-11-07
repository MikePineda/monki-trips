/**
 * The route line of a trip card, `ORG → MID → DST`: one chip per stop in
 * itinerary order, with consecutive stops in the same place collapsed into
 * one (a city you leave and come back to still shows twice).
 */
import { sortedStops, type TripStop } from './trip_stop.ts'

export interface RouteChip {
  label: string
  countryCode: string | null
  /** The stops the chip stands for, in order. */
  stopIds: string[]
}

function normalise(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function routeChips(
  stops: readonly Pick<TripStop, 'id' | 'position' | 'name' | 'countryCode'>[]
): RouteChip[] {
  const chips: RouteChip[] = []
  for (const stop of sortedStops(stops)) {
    const last = chips.at(-1)
    if (last && normalise(last.label) === normalise(stop.name)) {
      last.stopIds.push(stop.id)
      continue
    }
    chips.push({ label: stop.name.trim(), countryCode: stop.countryCode, stopIds: [stop.id] })
  }
  return chips
}
