import { tripToday } from './trip-today'

describe('tripToday', () => {
  const stops = [
    {
      position: 0,
      countryCode: 'JP',
      tz: 'Asia/Tokyo',
      arriveOn: '2027-01-20',
      departOn: '2027-01-23',
    },
  ]

  it('reads the date and hour in the zone of the stop being visited', () => {
    // 20:30 UTC on the 20th is 05:30 on the 21st in Tokyo.
    expect(tripToday('2027-01-20T20:30:00.000Z', 'UTC', stops)).toEqual({
      date: '2027-01-21',
      zone: 'Asia/Tokyo',
      hour: 5,
    })
  })

  it('falls back to the device zone outside every stop', () => {
    expect(tripToday('2026-11-07T12:00:00.000Z', 'UTC', stops)).toEqual({
      date: '2026-11-07',
      zone: 'UTC',
      hour: 12,
    })
  })
})
