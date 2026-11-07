import { blankSegment, blankStop, placedEvent } from '../../testing/fake-trip-content'
import { itineraryDays } from './itinerary-days'

const TRIP = { startsOn: '2027-01-20', endsOn: '2027-01-23' }

describe('itinerary days', () => {
  it('days are cut by the trip local date', () => {
    // 23:30 in the place is already the next day on a device further east: the place wins.
    const lateDinner = placedEvent('2027-01-21T23:30', 'Asia/Bangkok', {
      id: 'dinner',
      kind: 'meal',
      title: 'Late dinner',
    })

    const days = itineraryDays(TRIP, [lateDinner], [], [])

    expect(days.map((day) => day.date)).toEqual([
      '2027-01-20',
      '2027-01-21',
      '2027-01-22',
      '2027-01-23',
    ])
    expect(days[1].dayNumber).toBe(2)
    expect(days[1].items).toMatchObject([
      { eventId: 'dinner', role: 'start', time: '23:30', zone: 'Asia/Bangkok' },
    ])
    expect(days[2].items).toEqual([])
  })

  it('lodging spans its nights in the day list', () => {
    const inn = placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
      id: 'inn',
      kind: 'lodging',
      title: 'Harbour Inn',
      endsLocal: '2027-01-23T11:00',
    })

    const days = itineraryDays(TRIP, [inn], [], [])

    expect(days[0].items).toMatchObject([
      { role: 'check-in', time: '15:00', night: { number: 1, total: 3 } },
    ])
    expect(days[1].items).toMatchObject([
      { role: 'stay', time: null, night: { number: 2, total: 3 } },
    ])
    expect(days[2].items).toMatchObject([
      { role: 'stay', time: null, night: { number: 3, total: 3 } },
    ])
    expect(days[3].items).toMatchObject([
      { role: 'check-out', time: '11:00', night: { number: 3, total: 3 } },
    ])
  })

  it('a transport with legs shows the route once and its arrival on the day it lands', () => {
    const flight = placedEvent('2027-01-20T09:30', 'Australia/Sydney', {
      id: 'flight',
      kind: 'flight',
      title: 'Flight out',
    })
    const legs = [
      blankSegment({
        id: 'leg-1',
        eventId: 'flight',
        position: 1,
        originCode: 'HBT',
        destCode: 'IHB',
        departsLocal: '2027-01-20T09:30',
        departsTz: 'Australia/Sydney',
        arrivesLocal: '2027-01-20T14:10',
        arrivesTz: 'Asia/Bangkok',
      }),
      blankSegment({
        id: 'leg-2',
        eventId: 'flight',
        position: 2,
        number: 'DA 118',
        originCode: 'IHB',
        destCode: 'RVC',
        departsLocal: '2027-01-20T16:20',
        departsTz: 'Asia/Bangkok',
        arrivesLocal: '2027-01-21T01:05',
        arrivesTz: 'Asia/Bangkok',
      }),
    ]

    const days = itineraryDays(TRIP, [flight], legs, [])

    expect(days[0].items).toMatchObject([
      {
        role: 'start',
        time: '09:30',
        zone: 'Australia/Sydney',
        route: ['HBT', 'IHB', 'RVC'],
        carrier: 'Demo Air DA 101',
      },
    ])
    expect(days[0].chips).toEqual([['HBT', 'IHB', 'RVC']])
    expect(days[1].items).toMatchObject([{ role: 'arrival', time: '01:05', zone: 'Asia/Bangkok' }])
  })

  it('an overnight train without legs lands on the next day too', () => {
    const train = placedEvent('2027-01-21T20:30', 'Asia/Bangkok', {
      id: 'train',
      kind: 'train',
      title: 'Night train',
      endsLocal: '2027-01-22T07:15',
    })

    const days = itineraryDays(TRIP, [train], [], [])

    expect(days[1].items).toMatchObject([{ role: 'start', time: '20:30' }])
    expect(days[2].items).toMatchObject([{ role: 'arrival', time: '07:15' }])
  })

  it('a day without legs takes the stops it belongs to as its chip', () => {
    const stops = [
      blankStop({
        id: 'a',
        position: 0,
        name: 'Port Vellmar',
        arriveOn: '2027-01-20',
        departOn: '2027-01-21',
      }),
      blankStop({
        id: 'b',
        position: 1,
        name: 'Aldermoor',
        arriveOn: '2027-01-21',
        departOn: '2027-01-23',
      }),
    ]

    const days = itineraryDays(TRIP, [], [], stops)

    expect(days[0].chips).toEqual([['Port Vellmar']])
    expect(days[1].chips).toEqual([['Port Vellmar', 'Aldermoor']])
    expect(days[3].chips).toEqual([['Aldermoor']])
  })

  it('orders a day by local clock with all-day rows first, and adds dates outside the trip', () => {
    const stay = placedEvent('2027-01-19T15:00', 'Asia/Bangkok', {
      id: 'stay',
      kind: 'lodging',
      title: 'Early inn',
      endsLocal: '2027-01-21T11:00',
    })
    const walk = placedEvent('2027-01-20T09:00', 'Asia/Bangkok', {
      id: 'walk',
      kind: 'tour',
      title: 'Walk',
    })

    const days = itineraryDays(TRIP, [walk, stay], [], [])

    expect(days[0].date).toBe('2027-01-19')
    expect(days[0].dayNumber).toBeNull()
    expect(days[1].items.map((item) => item.key)).toEqual(['stay:stay:2027-01-20', 'walk:start'])
  })
})
