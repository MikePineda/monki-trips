import { computed, inject } from '@angular/core'
import { passportStamps } from '@monkitrips/shared'
import { CLOCK } from '../../core/offline/clock'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { travelRecords } from '../../core/offline/travel-records'
import { localToday } from '../../domain/local-today'
import { passportInput } from '../../domain/travel-history'

/**
 * The passport read from the device: every trip with its stops and
 * transports, today's date in the device's zone, and the country stamps
 * (cities inside) derived from them. Call from an injection context.
 */
export function passportData() {
  const records = travelRecords()
  const clock = inject(CLOCK)
  const zone = inject(TIME_ZONE)
  const today = computed(() => {
    records()
    return localToday(clock(), zone)
  })
  const countries = computed(() => passportStamps(passportInput({ ...records(), today: today() })))
  return { records, today, countries }
}
