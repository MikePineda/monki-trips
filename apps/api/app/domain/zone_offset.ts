import { IANAZone } from 'luxon'

/**
 * The UTC offset of an IANA zone at an instant, minutes east of UTC: the
 * resolver the shared reminder planner takes (`ZoneOffsetResolver`). Zones
 * are validated when they are written; one this runtime does not know reads
 * as UTC rather than failing a whole plan.
 */
export function zoneOffsetAt(tz: string, at: string): number {
  if (!IANAZone.isValidZone(tz)) return 0
  return IANAZone.create(tz).offset(Date.parse(at))
}
