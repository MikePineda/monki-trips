import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'
import type { I18n } from '@adonisjs/i18n'
import i18nManager from '@adonisjs/i18n/services/main'
import type { SyncMutation, SyncPushEntity } from '@monkitrips/shared'
import User from '#models/user'
import TripMember from '#models/trip_member'
import Trip from '#models/trip'
import Traveller from '#models/traveller'
import { Clock } from '#services/clock'
import { MutationApplier } from '#services/sync/mutation_applier'
import { TripCreation } from '#services/trip_creation'
import { normalizeEmail } from '#domain/normalize_email'
import { documentStorageKey } from '#domain/document_files'

export const DEMO_TRIP_NAME = 'Demo Loop'

/** A tiny PDF with one page of text, the "print this" voucher of the demo. Synthetic. */
const DEMO_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 60 >> stream
BT /F1 18 Tf 24 80 Td (Demo Loop rail voucher) Tj ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF
`
)

/**
 * Builds the "Demo Loop" trip through the same write path the app uses
 * (`MutationApplier`), so every derived value and side effect is the real
 * one. Everything is invented: cities, codes, prices, people.
 */
@inject()
export class DemoTrip {
  constructor(
    private readonly clock: Clock,
    private readonly creation: TripCreation,
    private readonly applier: MutationApplier
  ) {}

  async seed(input: {
    ownerEmail: string
    partnerEmail?: string
  }): Promise<{ tripId: string; created: boolean }> {
    const owner = await User.findByOrFail('email', normalizeEmail(input.ownerEmail))
    const existing = await Trip.query()
      .where('name', DEMO_TRIP_NAME)
      .where('created_by', owner.id)
      .whereNull('deleted_at')
      .first()
    if (existing) return { tripId: existing.id, created: false }

    const trip = await this.creation.create(owner, {
      name: DEMO_TRIP_NAME,
      baseCurrency: 'AUD',
      startsOn: '2027-01-20',
      endsOn: '2027-02-06',
      homeTz: 'Australia/Sydney',
      budgetTotalMinor: 1_250_000,
    })
    const partner = input.partnerEmail
      ? await User.findBy('email', normalizeEmail(input.partnerEmail))
      : null
    if (partner) {
      await TripMember.create({ tripId: trip.id, userId: partner.id, role: 'editor' })
      await Traveller.create({
        tripId: trip.id,
        userId: partner.id,
        displayName: partner.displayName,
        position: 1,
      })
    }
    const travellers = await Traveller.query().where('trip_id', trip.id).orderBy('position')
    const i18n = i18nManager.locale(i18nManager.defaultLocale)
    const push = this.pusher(owner, trip.id, i18n)

    // People: a friend without the app travels with us.
    const friend = await push('traveller', { displayName: 'Friend without the app', position: 2 })

    // Stops: invented places.
    const stops = {
      harbour: await push('stop', {
        position: 0,
        name: 'Harbour Town',
        countryCode: 'AU',
        tz: 'Australia/Sydney',
        arriveOn: '2027-01-20',
        departOn: '2027-01-20',
      }),
      river: await push('stop', {
        position: 1,
        name: 'River City',
        countryCode: 'TH',
        tz: 'Asia/Bangkok',
        arriveOn: '2027-01-21',
        departOn: '2027-01-26',
      }),
      lantern: await push('stop', {
        position: 2,
        name: 'Lantern Hills',
        countryCode: 'TH',
        tz: 'Asia/Bangkok',
        arriveOn: '2027-01-27',
        departOn: '2027-01-29',
      }),
      cedar: await push('stop', {
        position: 3,
        name: 'Cedar Bay',
        countryCode: 'JP',
        tz: 'Asia/Tokyo',
        arriveOn: '2027-01-29',
        departOn: '2027-02-05',
      }),
    }

    // The two-segment outbound flight with per-traveller seats.
    const outbound = await push('event', {
      kind: 'flight',
      title: 'Flight to River City',
      status: 'paid',
      stopId: stops.harbour,
      providerName: 'Demo Air',
      bookingCode: 'DEMO01',
      costMinor: 189_000,
      costCurrency: 'AUD',
      leaveBufferMin: 150,
      travelMin: 45,
    })
    const leg1 = await push('segment', {
      eventId: outbound,
      position: 1,
      carrier: 'Demo Air',
      number: 'DA 101',
      originName: 'Harbour Town',
      originCode: 'HBT',
      destName: 'Island Hub',
      destCode: 'IHB',
      departsLocal: '2027-01-20T09:30',
      departsTz: 'Australia/Sydney',
      arrivesLocal: '2027-01-20T14:10',
      arrivesTz: 'Asia/Singapore',
    })
    const leg2 = await push('segment', {
      eventId: outbound,
      position: 2,
      carrier: 'Demo Air',
      number: 'DA 118',
      originName: 'Island Hub',
      originCode: 'IHB',
      destName: 'River City',
      destCode: 'RVC',
      departsLocal: '2027-01-20T16:20',
      departsTz: 'Asia/Singapore',
      arrivesLocal: '2027-01-20T18:05',
      arrivesTz: 'Asia/Bangkok',
    })
    const seats = ['12A', '12B', '12C']
    for (const [index, traveller] of [...travellers.map((t) => t.id), friend].entries()) {
      for (const segment of [leg1, leg2]) {
        await push('seat', {
          segmentId: segment,
          travellerId: traveller,
          seat: seats[index],
          ticketNumber: `0000${index + 1}`,
        })
      }
    }

    // Where we sleep. The night of the 26th is left uncovered on purpose.
    await push('event', {
      kind: 'lodging',
      title: 'Riverside Inn',
      status: 'booked',
      stopId: stops.river,
      startsLocal: '2027-01-20T20:00',
      startTz: 'Asia/Bangkok',
      endsLocal: '2027-01-26T11:00',
      endTz: 'Asia/Bangkok',
      costMinor: 1_260_000,
      costCurrency: 'THB',
      placeName: 'Riverside Inn',
      address: '1 Demo Road, River City',
    })
    await push('event', {
      kind: 'train',
      title: 'Night train to Lantern Hills',
      status: 'booked',
      stopId: stops.river,
      startsLocal: '2027-01-27T20:30',
      startTz: 'Asia/Bangkok',
      endsLocal: '2027-01-28T07:15',
      endTz: 'Asia/Bangkok',
      providerName: 'Demo Rail',
      bookingCode: 'DEMO02',
      costMinor: 360_000,
      costCurrency: 'THB',
      leaveBufferMin: 30,
    })
    await push('event', {
      kind: 'lodging',
      title: 'Hillside Guesthouse',
      status: 'booked',
      stopId: stops.lantern,
      startsLocal: '2027-01-28T14:00',
      startTz: 'Asia/Bangkok',
      endsLocal: '2027-01-29T10:00',
      endTz: 'Asia/Bangkok',
    })
    await push('event', {
      kind: 'flight',
      title: 'Flight to Cedar Bay',
      status: 'booked',
      stopId: stops.lantern,
      startsLocal: '2027-01-29T13:00',
      startTz: 'Asia/Bangkok',
      endsLocal: '2027-01-29T21:30',
      endTz: 'Asia/Tokyo',
      providerName: 'Demo Air',
      bookingCode: 'DEMO03',
      costMinor: 92_000,
      costCurrency: 'AUD',
    })
    await push('event', {
      kind: 'lodging',
      title: 'Cedar Bay Apartment',
      status: 'paid',
      stopId: stops.cedar,
      startsLocal: '2027-01-29T22:30',
      startTz: 'Asia/Tokyo',
      endsLocal: '2027-02-05T10:00',
      endTz: 'Asia/Tokyo',
      costMinor: 9_800_000,
      costCurrency: 'JPY',
    })
    // The last night is spent on the plane home.
    await push('event', {
      kind: 'flight',
      title: 'Flight home',
      status: 'booked',
      stopId: stops.cedar,
      startsLocal: '2027-02-05T21:50',
      startTz: 'Asia/Tokyo',
      endsLocal: '2027-02-06T09:40',
      endTz: 'Australia/Sydney',
      providerName: 'Demo Air',
      bookingCode: 'DEMO04',
      costMinor: 174_000,
      costCurrency: 'AUD',
    })
    const templeWalk = await push('event', {
      kind: 'tour',
      title: 'Temple walk',
      status: 'to_book',
      stopId: stops.river,
      startsLocal: '2027-01-22T09:00',
      startTz: 'Asia/Bangkok',
      endsLocal: '2027-01-22T12:00',
      endTz: 'Asia/Bangkok',
      travelMin: 20,
    })

    // Expenses in two foreign currencies, one of them zero-decimal; one quick capture waiting for its rate.
    const categories = await this.categories(trip.id)
    await push('expense', {
      categoryId: categories.food,
      amountMinor: 45_000,
      currency: 'THB',
      fxRate: '22.5',
      fxSource: 'manual',
      spentOn: '2027-01-21',
      description: 'Street food dinner',
      paidByTravellerId: travellers[0].id,
    })
    await push('expense', {
      categoryId: categories.transport,
      amountMinor: 1_900,
      currency: 'JPY',
      fxRate: '95',
      fxSource: 'manual',
      spentOn: '2027-01-30',
      description: 'Local train',
      paidByTravellerId: travellers[0].id,
    })
    // A quick capture in a currency the fake provider does not know stays pending in development.
    await push('expense', {
      amountMinor: 85_000,
      currency: 'VND',
      spentOn: '2027-01-23',
      needsDetails: true,
    })

    // Documents: a fake PDF to print, linked to the night train.
    const voucherId = randomUUID()
    await drive
      .use()
      .put(documentStorageKey(trip.id, voucherId), DEMO_PDF, { contentType: 'application/pdf' })
    await this.insertFileDocument(trip.id, voucherId, owner.id, 'Night train voucher')
    await push('document', { tags: ['print'], eventId: null }, { id: voucherId })
    await push('document', {
      kind: 'link',
      title: 'Temple walk tickets',
      url: 'https://example.com/tickets/demo',
      eventId: templeWalk,
      tags: ['show_on_phone'],
    })

    // Tasks: one overdue, one high priority.
    await push('task', { title: 'Renew travel insurance', dueOn: '2026-10-01', priority: 'normal' })
    await push('task', { title: 'Check passport validity', dueOn: '2027-01-10', priority: 'high' })
    await push('task', { title: 'Download offline maps', priority: 'low' })

    await push(
      'emergency',
      {
        contacts: [{ name: 'Travel insurer hotline', phone: '0800 DEMO', note: null }],
        notes: 'Synthetic emergency notes for the demo trip.',
      },
      { id: trip.id }
    )

    return { tripId: trip.id, created: true }
  }

  /** A push of one upsert that must apply; returns the row id. */
  private pusher(owner: User, tripId: string, i18n: I18n) {
    return async (
      entity: SyncPushEntity,
      changes: Record<string, unknown>,
      overrides: Partial<SyncMutation> = {}
    ): Promise<string> => {
      const now = this.clock.now()
      const mutation: SyncMutation = {
        mutationId: randomUUID(),
        tripId,
        entity,
        op: 'upsert',
        id: randomUUID(),
        changes,
        changedAt: now.toISOString(),
        ...overrides,
      }
      const result = await this.applier.apply(owner, mutation, i18n)
      if (result.status !== 'applied') {
        throw new Error(`demo trip: ${entity} ${result.status}: ${JSON.stringify(result.error)}`)
      }
      return mutation.id
    }
  }

  private async categories(tripId: string): Promise<Record<string, string>> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const rows = (await db
      .from('budget_categories')
      .where('trip_id', tripId)
      .whereNull('deleted_at')
      .select('id', 'key')) as { id: string; key: string }[]
    return Object.fromEntries(rows.map((row) => [row.key, row.id]))
  }

  private async insertFileDocument(tripId: string, id: string, userId: string, title: string) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { createHash } = await import('node:crypto')
    await db.table('documents').insert({
      id,
      trip_id: tripId,
      kind: 'file',
      title,
      storage_key: documentStorageKey(tripId, id),
      mime: 'application/pdf',
      size_bytes: DEMO_PDF.length,
      sha256: createHash('sha256').update(DEMO_PDF).digest('hex'),
      tags: [],
      uploaded_by: userId,
      updated_by: userId,
      field_clock: JSON.stringify({ title: DateTime.fromJSDate(this.clock.now()).toMillis() }),
    })
  }
}
