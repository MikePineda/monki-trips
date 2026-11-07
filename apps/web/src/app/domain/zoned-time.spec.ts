import {
  localClock,
  localToInstant,
  zoneAbbreviation,
  zoneLabel,
  zoneOffsetMinutes,
  zoneOptions,
  zonedInstant,
} from './zoned-time'

describe('zoned time', () => {
  it('reads the offset of a zone at an instant', () => {
    expect(zoneOffsetMinutes('Asia/Bangkok', Date.parse('2027-01-27T13:30:00Z'))).toBe(420)
    expect(zoneOffsetMinutes('Australia/Sydney', Date.parse('2027-01-20T00:00:00Z'))).toBe(660)
    expect(zoneOffsetMinutes('Asia/Kathmandu', Date.parse('2027-01-20T00:00:00Z'))).toBe(345)
  })

  it('turns a local time in a zone into the instant', () => {
    expect(localToInstant('2027-01-27T20:30', 'Asia/Bangkok')).toBe('2027-01-27T13:30:00.000Z')
    expect(localToInstant('2027-01-20T09:30:00', 'Australia/Sydney')).toBe(
      '2027-01-19T22:30:00.000Z'
    )
  })

  it('a time the clocks jumped over does not exist', () => {
    // Sydney springs forward on 2026-10-04 at 02:00 → 03:00.
    expect(localToInstant('2026-10-04T02:30', 'Australia/Sydney')).toBeNull()
  })

  it('a time that exists twice is the earlier instant', () => {
    // Sydney falls back on 2027-04-04 at 03:00 → 02:00: 02:30 happens at +11 first.
    expect(localToInstant('2027-04-04T02:30', 'Australia/Sydney')).toBe('2027-04-03T15:30:00.000Z')
  })

  it('rejects malformed times and unknown zones', () => {
    expect(localToInstant('2027-01-27', 'Asia/Bangkok')).toBeNull()
    expect(localToInstant('2027-01-27T20:30', 'Mars/Olympus')).toBeNull()
  })

  it('builds the domain zoned instant the pipelines read', () => {
    expect(zonedInstant('2027-01-27T13:30:00.000Z', 'Asia/Bangkok')).toEqual({
      at: '2027-01-27T13:30:00.000Z',
      offsetMin: 420,
      tz: 'Asia/Bangkok',
    })
  })

  it('shows the zone only when the place and the device disagree', () => {
    const at = Date.parse('2027-01-27T13:30:00Z')
    expect(zoneLabel('Asia/Bangkok', at, 'Asia/Bangkok', 'en-AU')).toBeNull()
    expect(zoneLabel('Asia/Bangkok', at, 'Asia/Ho_Chi_Minh', 'en-AU')).toBeNull()
    expect(zoneLabel('Asia/Bangkok', at, 'Australia/Sydney', 'en-AU')).toBe(
      zoneAbbreviation('Asia/Bangkok', at, 'en-AU')
    )
    expect(zoneLabel('Mars/Olympus', at, 'Australia/Sydney', 'en-AU')).toBeNull()
  })

  it('reads the clock of a local time', () => {
    expect(localClock('2027-01-27T20:30')).toBe('20:30')
    expect(localClock('2027-01-27T20:30:00')).toBe('20:30')
  })

  it('offers the known zones and keeps an unknown current value first', () => {
    expect(zoneOptions()).toContain('Asia/Bangkok')
    expect(zoneOptions('Mars/Olympus')[0]).toBe('Mars/Olympus')
  })
})
