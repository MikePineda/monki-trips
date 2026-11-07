import { test } from '@japa/runner'
import { buildTripJsonV1 } from '#domain/trip_export'

const trip = {
  id: 'trip-1',
  name: 'Demo Loop',
  baseCurrency: 'AUD',
  budgetMode: 'shared' as const,
  budgetTotalMinor: 500000,
  startsOn: '2027-01-20',
  endsOn: '2027-02-06',
  homeTz: 'Australia/Sydney',
  createdBy: 'user-1',
  deletedAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
}

test.group('Trip JSON v1 export', () => {
  test('writes schema version 1 with the trip, roles and travellers but no account ids', ({
    assert,
  }) => {
    const document = buildTripJsonV1({
      trip,
      members: [
        { id: 'm1', tripId: 'trip-1', userId: 'user-1', role: 'owner', displayName: 'Owner', joinedAt: 'x' },
        { id: 'm2', tripId: 'trip-1', userId: 'user-2', role: 'editor', displayName: 'Partner', joinedAt: 'y' },
      ],
      travellers: [
        { id: 't1', tripId: 'trip-1', displayName: 'Owner', userId: 'user-1', position: 0 },
        { id: 't2', tripId: 'trip-1', displayName: 'Kid', userId: null, position: 1 },
      ],
      exportedAt: new Date('2026-11-07T10:00:00Z'),
    })

    assert.deepEqual(document, {
      schemaVersion: 1,
      exportedAt: '2026-11-07T10:00:00.000Z',
      trip: {
        id: 'trip-1',
        name: 'Demo Loop',
        baseCurrency: 'AUD',
        budgetMode: 'shared',
        budgetTotalMinor: 500000,
        startsOn: '2027-01-20',
        endsOn: '2027-02-06',
        homeTz: 'Australia/Sydney',
      },
      members: [
        { role: 'owner', displayName: 'Owner' },
        { role: 'editor', displayName: 'Partner' },
      ],
      travellers: [
        { id: 't1', displayName: 'Owner', position: 0 },
        { id: 't2', displayName: 'Kid', position: 1 },
      ],
    })
    assert.notInclude(JSON.stringify(document), 'user-1')
  })
})
