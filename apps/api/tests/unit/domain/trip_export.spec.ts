import { test } from '@japa/runner'
import type { TripContentSnapshot } from '@monkitrips/shared'
import { buildTripJsonV1 } from '#domain/trip_export'

const AT = '2026-11-02T00:00:00.000Z'

/** A small synthetic snapshot: two people, one stop, a two-leg flight with a seat, a voucher, an expense split. */
const snapshot: TripContentSnapshot = {
  trip: {
    id: 'trip-1',
    name: 'Demo Loop',
    baseCurrency: 'AUD',
    budgetMode: 'shared',
    budgetTotalMinor: 500000,
    startsOn: '2027-01-20',
    endsOn: '2027-02-06',
    homeTz: 'Australia/Sydney',
    createdBy: 'user-1',
    deletedAt: null,
    createdAt: AT,
    updatedAt: AT,
  },
  members: [
    {
      id: 'm1',
      tripId: 'trip-1',
      userId: 'user-1',
      role: 'owner',
      displayName: 'Owner',
      joinedAt: AT,
    },
    {
      id: 'm2',
      tripId: 'trip-1',
      userId: 'user-2',
      role: 'editor',
      displayName: 'Partner',
      joinedAt: AT,
    },
  ],
  travellers: [
    { id: 't1', tripId: 'trip-1', displayName: 'Owner', userId: 'user-1', position: 0 },
    { id: 't2', tripId: 'trip-1', displayName: 'Kid', userId: null, position: 1 },
  ],
  stops: [
    {
      id: 's1',
      tripId: 'trip-1',
      position: 0,
      name: 'Harbour Town',
      countryCode: 'AU',
      lat: null,
      lng: null,
      tz: 'Australia/Sydney',
      arriveOn: '2027-01-20',
      departOn: '2027-01-20',
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  events: [
    {
      id: 'e1',
      tripId: 'trip-1',
      stopId: 's1',
      kind: 'flight',
      title: 'Flight out',
      status: 'paid',
      startsLocal: '2027-01-20T09:30:00',
      startTz: 'Australia/Sydney',
      startsAt: '2027-01-19T22:30:00.000Z',
      startsOn: '2027-01-20',
      endsLocal: '2027-01-20T18:05:00',
      endTz: 'Asia/Bangkok',
      endsAt: '2027-01-20T11:05:00.000Z',
      placeName: null,
      address: null,
      addressLocal: null,
      lat: null,
      lng: null,
      providerName: 'Demo Air',
      bookingCode: 'DEMO01',
      costMinor: 189000,
      costCurrency: 'AUD',
      notes: null,
      leaveBufferMin: 150,
      travelMin: 45,
      coversNight: null,
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  segments: [
    {
      id: 'g1',
      tripId: 'trip-1',
      eventId: 'e1',
      position: 1,
      carrier: 'Demo Air',
      number: 'DA 101',
      originName: 'Harbour Town',
      originCode: 'HBT',
      originLat: null,
      originLng: null,
      destName: 'River City',
      destCode: 'RVC',
      destLat: null,
      destLng: null,
      departsLocal: '2027-01-20T09:30:00',
      departsTz: 'Australia/Sydney',
      departsAt: '2027-01-19T22:30:00.000Z',
      arrivesLocal: '2027-01-20T18:05:00',
      arrivesTz: 'Asia/Bangkok',
      arrivesAt: '2027-01-20T11:05:00.000Z',
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  seats: [
    {
      id: 'seat1',
      tripId: 'trip-1',
      segmentId: 'g1',
      travellerId: 't2',
      seat: '12B',
      coach: null,
      ticketNumber: '00002',
      documentId: 'd1',
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  documents: [
    {
      id: 'd1',
      tripId: 'trip-1',
      eventId: 'e1',
      kind: 'file',
      title: 'Voucher',
      url: null,
      mime: 'application/pdf',
      sizeBytes: 412,
      sha256: 'abc',
      tags: ['print'],
      availableOffline: false,
      uploadedBy: 'user-1',
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  tasks: [
    {
      id: 'k1',
      tripId: 'trip-1',
      eventId: null,
      title: 'Voucher',
      titleKey: 'print_document',
      notes: null,
      dueOn: '2027-01-19',
      priority: 'normal',
      doneAt: null,
      doneBy: null,
      origin: 'document',
      sourceDocumentId: 'd1',
      templateItemKey: null,
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  budgetCategories: [
    {
      id: 'c1',
      tripId: 'trip-1',
      key: 'food',
      name: null,
      budgetMinor: null,
      position: 2,
      deletedAt: null,
      updatedAt: AT,
    },
    {
      id: 'c2',
      tripId: 'trip-1',
      key: null,
      name: 'Souvenirs',
      budgetMinor: 30000,
      position: 6,
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  expenses: [
    {
      id: 'x1',
      tripId: 'trip-1',
      categoryId: 'c2',
      eventId: 'e1',
      amountMinor: 45000,
      currency: 'THB',
      fxRate: '22.5',
      fxRateDate: '2027-01-21',
      fxSource: 'manual',
      baseAmountMinor: 2000,
      spentOn: '2027-01-21',
      description: 'Dinner',
      paidByTravellerId: 't1',
      needsDetails: false,
      createdBy: 'user-1',
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  expenseShares: [
    {
      id: 'sh1',
      tripId: 'trip-1',
      expenseId: 'x1',
      travellerId: 't1',
      shareMinor: 22500,
      deletedAt: null,
      updatedAt: AT,
    },
    {
      id: 'sh2',
      tripId: 'trip-1',
      expenseId: 'x1',
      travellerId: 't2',
      shareMinor: 22500,
      deletedAt: null,
      updatedAt: AT,
    },
  ],
  emergency: {
    tripId: 'trip-1',
    content: { notes: 'Synthetic notes' },
    schemaVersion: 1,
    deletedAt: null,
    updatedAt: AT,
  },
  phraseCards: [],
}

test.group('Trip JSON v1 export', () => {
  test('replaces ids with refs, nests legs and seats, and leaks no account id', ({ assert }) => {
    const document = buildTripJsonV1({
      snapshot,
      files: new Map([
        ['d1', { storageKey: 'trips/trip-1/d1', downloadUrl: 'http://localhost/signed' }],
      ]),
      exportedAt: new Date('2026-11-07T10:00:00Z'),
    })

    assert.equal(document.version, 'trip-json-v1')
    assert.equal(document.schemaVersion, 1)
    assert.equal(document.exportedAt, '2026-11-07T10:00:00.000Z')
    assert.deepEqual(document.trip, {
      name: 'Demo Loop',
      baseCurrency: 'AUD',
      budgetMode: 'shared',
      budgetTotalMinor: 500000,
      startsOn: '2027-01-20',
      endsOn: '2027-02-06',
      homeTz: 'Australia/Sydney',
    })
    assert.deepEqual(document.members, [
      { role: 'owner', displayName: 'Owner' },
      { role: 'editor', displayName: 'Partner' },
    ])
    assert.deepEqual(document.travellers, [
      { ref: 'traveller-1', displayName: 'Owner', position: 0 },
      { ref: 'traveller-2', displayName: 'Kid', position: 1 },
    ])
    const [flight] = document.events
    assert.include(flight, {
      ref: 'event-1',
      stopRef: 'stop-1',
      startsLocal: '2027-01-20T09:30:00',
      startTz: 'Australia/Sydney',
    })
    assert.notProperty(flight, 'startsAt')
    assert.lengthOf(flight.segments, 1)
    assert.include(flight.segments[0], { ref: 'segment-1', departsTz: 'Australia/Sydney' })
    assert.deepEqual(flight.segments[0].seats, [
      {
        travellerRef: 'traveller-2',
        seat: '12B',
        coach: null,
        ticketNumber: '00002',
        documentRef: 'document-1',
      },
    ])
    assert.deepEqual(
      document.budgetCategories.map((c) => c.ref),
      ['category-food', 'category-2']
    )
    const [dinner] = document.expenses
    assert.include(dinner, {
      eventRef: 'event-1',
      categoryRef: 'category-2',
      fxRate: '22.5',
      baseAmountMinor: 2000,
      paidByTravellerRef: 'traveller-1',
    })
    assert.deepEqual(dinner.shares, [
      { travellerRef: 'traveller-1', shareMinor: 22500 },
      { travellerRef: 'traveller-2', shareMinor: 22500 },
    ])
    assert.include(document.tasks[0], {
      origin: 'document',
      sourceDocumentRef: 'document-1',
      titleKey: 'print_document',
    })
    assert.include(document.documents[0], {
      ref: 'document-1',
      eventRef: 'event-1',
      kind: 'file',
      storageKey: 'trips/trip-1/d1',
      downloadUrl: 'http://localhost/signed',
      sha256: 'abc',
    })
    assert.deepEqual(document.emergency, { notes: 'Synthetic notes' })
    assert.isNull(document.notes)
    const text = JSON.stringify(document)
    assert.notInclude(text, 'user-1')
    assert.notInclude(text, 'user-2')
    assert.notInclude(text, '"e1"')
  })

  test('a file document whose store could not sign a link keeps its storage key and a null url', ({
    assert,
  }) => {
    const document = buildTripJsonV1({
      snapshot,
      files: new Map([['d1', { storageKey: 'trips/trip-1/d1', downloadUrl: null }]]),
      exportedAt: new Date('2026-11-07T10:00:00Z'),
    })
    assert.include(document.documents[0], { storageKey: 'trips/trip-1/d1', downloadUrl: null })
  })
})
