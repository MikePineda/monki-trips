import { historyEntries, passportInput, tripSeries } from './travel-history'

const TRIPS = [
  {
    id: 'past',
    name: 'Island hop',
    startDate: '2026-05-01',
    endDate: '2026-05-10',
    baseCurrency: 'EUR',
  },
  {
    id: 'next',
    name: 'Snow week',
    startDate: '2027-02-01',
    endDate: '2027-02-07',
    baseCurrency: 'CHF',
  },
]

function stop(
  id: string,
  tripId: string,
  position: number,
  name: string,
  countryCode: string | null
) {
  return {
    id,
    tripId,
    position,
    name,
    countryCode,
    arriveOn: null,
    departOn: null,
    lat: null,
    lng: null,
  }
}

describe('travel history', () => {
  it('summarises each trip for its ticket: route, days, nights, countries, spend and cover stamp', () => {
    const [past, next] = historyEntries({
      trips: TRIPS,
      stops: [
        stop('b', 'past', 1, 'Old Town', 'XB'),
        stop('a', 'past', 0, 'Harbour City', 'XA'),
        stop('c', 'past', 2, 'Hill Fort', 'XB'),
      ],
      expenses: [
        { tripId: 'past', baseAmountMinor: 12_000 },
        { tripId: 'past', baseAmountMinor: null },
        { tripId: 'past', baseAmountMinor: 3_050 },
        { tripId: 'next', baseAmountMinor: 900 },
      ],
      today: '2026-11-08',
    })

    expect(past).toMatchObject({
      id: 'past',
      phase: 'past',
      route: ['Harbour City', 'Old Town', 'Hill Fort'],
      days: 10,
      nights: 9,
      countries: ['XA', 'XB'],
      spentMinor: 15_050,
      currency: 'EUR',
      cover: { code: 'XA', name: 'Harbour City', date: '2026-05-01' },
    })
    expect(next).toMatchObject({
      id: 'next',
      phase: 'upcoming',
      route: [],
      spentMinor: 900,
      cover: null,
    })
  })

  it('gives every trip a stable map colour, oldest trip first', () => {
    const series = tripSeries([
      { id: 'b', startDate: '2026-05-01' },
      { id: 'a', startDate: '2025-01-01' },
      { id: 'c', startDate: '2027-01-01' },
    ])
    expect([series.get('a'), series.get('b'), series.get('c')]).toEqual([1, 2, 3])

    const many = tripSeries(
      Array.from({ length: 10 }, (_, index) => ({
        id: `t${index}`,
        startDate: `2026-01-1${index}`,
      }))
    )
    expect(many.get('t8')).toBe(1)
    expect(many.get('t9')).toBe(2)
  })

  it('reads the arrivals from transport events: the last leg lands, else the event end, else its day', () => {
    const input = passportInput({
      trips: TRIPS,
      stops: [],
      events: [
        {
          id: 'f',
          tripId: 'past',
          kind: 'flight',
          status: 'booked',
          startsOn: '2026-04-30',
          endsLocal: null,
        },
        {
          id: 't',
          tripId: 'past',
          kind: 'train',
          status: 'paid',
          startsOn: '2026-05-05',
          endsLocal: '2026-05-06T09:00:00',
        },
        {
          id: 'b',
          tripId: 'past',
          kind: 'bus',
          status: 'booked',
          startsOn: '2026-05-08',
          endsLocal: null,
        },
        {
          id: 'l',
          tripId: 'past',
          kind: 'lodging',
          status: 'booked',
          startsOn: '2026-05-01',
          endsLocal: null,
        },
      ],
      segments: [
        { eventId: 'f', position: 1, arrivesLocal: '2026-05-01T07:10:00' },
        { eventId: 'f', position: 0, arrivesLocal: '2026-04-30T22:00:00' },
      ],
      today: '2026-11-08',
    })

    expect(input.arrivals).toEqual([
      { tripId: 'past', kind: 'flight', status: 'booked', arrivesOn: '2026-05-01' },
      { tripId: 'past', kind: 'train', status: 'paid', arrivesOn: '2026-05-06' },
      { tripId: 'past', kind: 'bus', status: 'booked', arrivesOn: '2026-05-08' },
    ])
    expect(input.trips).toEqual([
      { id: 'past', name: 'Island hop', startsOn: '2026-05-01', endsOn: '2026-05-10' },
      { id: 'next', name: 'Snow week', startsOn: '2027-02-01', endsOn: '2027-02-07' },
    ])
    expect(input.today).toBe('2026-11-08')
  })
})
