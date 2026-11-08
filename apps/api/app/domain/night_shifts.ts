import type { AiNightShift, TripNight } from '@monkitrips/shared'

function coverOf(night: TripNight | undefined): AiNightShift['before'] {
  const cover = night?.coveredBy
  return cover ? { eventId: cover.eventId, title: cover.title } : null
}

/**
 * The nights whose cover changes between two runs of the shared night
 * rules (before and after a proposed change), in date order: a night that
 * loses its bed has `after: null`, a night that gains one `before: null`.
 * Nights with the same cover on both sides are left out.
 */
export function nightShifts(before: TripNight[], after: TripNight[]): AiNightShift[] {
  const beforeByDate = new Map(before.map((night) => [night.date, night]))
  const afterByDate = new Map(after.map((night) => [night.date, night]))
  const dates = [...new Set([...beforeByDate.keys(), ...afterByDate.keys()])].sort()
  const shifts: AiNightShift[] = []
  for (const date of dates) {
    const was = coverOf(beforeByDate.get(date))
    const will = coverOf(afterByDate.get(date))
    if (was?.eventId === will?.eventId) continue
    shifts.push({ date, before: was, after: will })
  }
  return shifts
}
