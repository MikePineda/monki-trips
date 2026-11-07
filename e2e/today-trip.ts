import { randomUUID } from 'node:crypto'
import type { E2eAccount } from './accounts.ts'
import { ApiSession } from './api-session.ts'

/** A tiny but real PDF: the API sniffs the bytes, never the name. */
const SAMPLE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'
)

export interface TodayTrip {
  tripId: string
  /** Day 1 of the trip; it starts years from now, so Today previews it. */
  startsOn: string
}

/**
 * A synthetic trip for the travel-mode journeys, written through the API
 * like the app writes it: one stop, a harbour walk on day 1 with its
 * entry pass (show on the phone) and a voucher to print, and lodging for
 * the first two nights. Invented places and codes only.
 */
export async function seedTodayTrip(account: E2eAccount): Promise<TodayTrip> {
  const api = await ApiSession.signIn(account)
  try {
    await api.deleteAllTrips()
    const startsOn = '2030-03-01'
    const tripId = await api.createTrip({
      name: 'Harbour escape',
      startsOn,
      endsOn: '2030-03-05',
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
          arriveOn: '2030-03-01',
          departOn: '2030-03-05',
        },
      },
      {
        entity: 'event',
        id: walkId,
        changes: {
          kind: 'tour',
          title: 'Harbour walk',
          status: 'booked',
          startsLocal: '2030-03-01T10:00',
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
          startsLocal: '2030-03-01T15:00',
          startTz: 'Asia/Bangkok',
          endsLocal: '2030-03-03T11:00',
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
