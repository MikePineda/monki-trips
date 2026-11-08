import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { E2eAccount } from './accounts.ts'
import { ApiSession } from './api-session.ts'

/** The synthetic voucher J04 uploads: a real PDF, since the API sniffs the bytes. */
const SAMPLE_PDF = readFileSync(new URL('./fixtures/voucher.pdf', import.meta.url))

export interface TodayTrip {
  tripId: string
  /** Day 1 of the trip; it starts years from now, so Today previews it. */
  startsOn: string
}

/** Synthetic coordinates of the invented harbour town (open sea, nobody lives there). */
const HARBOUR = { lat: 10.25, lng: 120.75 }

/** A `YYYY-MM-DD` date `days` after `date`. */
function plusDays(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

/** Today's date at the harbour (Asia/Bangkok), for a trip that is under way. */
export function harbourToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now)
}

/**
 * A synthetic trip for the travel-mode journeys, written through the API
 * like the app writes it: one placed stop, a harbour walk on day 1 with its
 * entry pass (show on the phone) and a voucher to print, and lodging for
 * the first two nights. Invented places, coordinates and codes only. By
 * default it starts years from now (Today previews day 1 and no forecast
 * reaches it); `startsOn` moves it, e.g. to today for the weather.
 */
export async function seedTodayTrip(
  account: E2eAccount,
  options: { startsOn?: string } = {}
): Promise<TodayTrip> {
  const api = await ApiSession.signIn(account)
  try {
    await api.deleteAllTrips()
    const startsOn = options.startsOn ?? '2030-03-01'
    const day = (offset: number) => plusDays(startsOn, offset)
    const tripId = await api.createTrip({
      name: 'Harbour escape',
      startsOn,
      endsOn: day(4),
      baseCurrency: 'EUR',
    })
    const stopId = randomUUID()
    const walkId = randomUUID()
    const innId = randomUUID()
    await api.push(tripId, [
      {
        entity: 'stop',
        id: stopId,
        changes: {
          position: 0,
          name: 'Port Vellmar',
          countryCode: 'XA',
          tz: 'Asia/Bangkok',
          arriveOn: startsOn,
          departOn: day(4),
          ...HARBOUR,
        },
      },
      {
        entity: 'event',
        id: walkId,
        changes: {
          kind: 'tour',
          title: 'Harbour walk',
          status: 'booked',
          startsLocal: `${startsOn}T10:00`,
          startTz: 'Asia/Bangkok',
          address: '14 Quay Lane',
          bookingCode: 'DEMO07',
        },
      },
      {
        entity: 'event',
        id: innId,
        changes: {
          kind: 'lodging',
          title: 'Lighthouse Rooms',
          status: 'booked',
          startsLocal: `${startsOn}T15:00`,
          startTz: 'Asia/Bangkok',
          endsLocal: `${day(2)}T11:00`,
          endTz: 'Asia/Bangkok',
          address: '2 Beacon Road',
          addressLocal: 'Οδός Φάρου 2',
        },
      },
    ])
    const pass = await api.uploadDocument(
      tripId,
      { name: 'entry-pass.pdf', mimeType: 'application/pdf', buffer: SAMPLE_PDF },
      { title: 'Entry pass', eventId: walkId }
    )
    const voucher = await api.uploadDocument(
      tripId,
      { name: 'voucher.pdf', mimeType: 'application/pdf', buffer: SAMPLE_PDF },
      { title: 'Walk voucher', eventId: walkId }
    )
    await api.push(tripId, [
      { entity: 'document', id: pass, changes: { tags: ['show_on_phone'] } },
      { entity: 'document', id: voucher, changes: { tags: ['print'] } },
    ])
    return { tripId, startsOn }
  } finally {
    await api.dispose()
  }
}
