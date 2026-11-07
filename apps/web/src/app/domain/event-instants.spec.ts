import { nightCoverage } from '@monkitrips/shared'
import { blankEvent, blankSegment, placedEvent } from '../../testing/fake-trip-content'
import { toDomainEvent, toDomainEvents } from './event-instants'

describe('event instants', () => {
  it('resolves the stored instants with the offset of their zone', () => {
    const event = toDomainEvent(
      placedEvent('2027-01-21T20:30', 'Asia/Bangkok', { endsLocal: '2027-01-22T07:15' })
    )

    expect(event?.starts).toEqual({
      at: '2027-01-21T13:30:00.000Z',
      offsetMin: 420,
      tz: 'Asia/Bangkok',
    })
    expect(event?.ends?.at).toBe('2027-01-22T00:15:00.000Z')
    expect(event?.segments).toBeUndefined()
  })

  it('nests the legs of a transport under their event', () => {
    const event = toDomainEvent(
      placedEvent('2027-01-20T09:30', 'Asia/Bangkok', { id: 'f1', kind: 'flight' }),
      [blankSegment({ id: 'g1', eventId: 'f1' }), blankSegment({ id: 'g2', eventId: 'other' })]
    )

    expect(event?.segments?.map((segment) => segment.id)).toEqual(['g1'])
  })

  it('leaves out an event that has no start yet', () => {
    expect(toDomainEvents([blankEvent({ id: 'idea' })])).toEqual([])
  })

  it('uncovered night shows the alert: the night coverage reads the resolved events', () => {
    const lodging = placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
      id: 'l1',
      kind: 'lodging',
      endsLocal: '2027-01-22T11:00',
    })

    const report = nightCoverage(
      { startsOn: '2027-01-20', endsOn: '2027-01-24' },
      toDomainEvents([lodging])
    )

    expect(report.uncovered).toEqual(['2027-01-22', '2027-01-23'])
  })
})
