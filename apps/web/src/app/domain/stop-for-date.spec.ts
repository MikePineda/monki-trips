import { stopForDate, type DatedStop } from './stop-for-date'

function stop(overrides: Partial<DatedStop> & { position: number }): DatedStop {
  return { countryCode: null, arriveOn: null, departOn: null, ...overrides }
}

describe('stopForDate', () => {
  const harbour = stop({
    position: 0,
    countryCode: 'JP',
    arriveOn: '2027-01-20',
    departOn: '2027-01-23',
  })
  const hills = stop({
    position: 1,
    countryCode: 'TH',
    arriveOn: '2027-01-23',
    departOn: '2027-01-26',
  })

  it('finds the stop whose stay covers the date', () => {
    expect(stopForDate([harbour, hills], '2027-01-21')).toBe(harbour)
    expect(stopForDate([harbour, hills], '2027-01-25')).toBe(hills)
  })

  it('on a day that moves between stops, the one arrived at wins', () => {
    expect(stopForDate([hills, harbour], '2027-01-23')).toBe(hills)
  })

  it('answers null outside every stay or when the stops have no dates', () => {
    expect(stopForDate([harbour, hills], '2027-01-19')).toBeNull()
    expect(stopForDate([harbour, hills], '2027-01-27')).toBeNull()
    expect(stopForDate([stop({ position: 0, countryCode: 'JP' })], '2027-01-21')).toBeNull()
    expect(stopForDate([], '2027-01-21')).toBeNull()
  })
})
