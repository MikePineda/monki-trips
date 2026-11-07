import { placedEvent } from '../../testing/fake-trip-content'
import { nightsView } from './nights-view'

const TRIP = { startsOn: '2027-01-20', endsOn: '2027-01-24' }

describe('nights view', () => {
  it('lists every night with what covers it and counts the gaps', () => {
    const inn = placedEvent('2027-01-20T15:00', 'Asia/Bangkok', {
      id: 'inn',
      kind: 'lodging',
      title: 'Harbour Inn',
      endsLocal: '2027-01-22T11:00',
    })
    const train = placedEvent('2027-01-22T20:30', 'Asia/Bangkok', {
      id: 'train',
      kind: 'train',
      title: 'Night train',
      endsLocal: '2027-01-23T07:15',
    })

    const view = nightsView(TRIP, [inn, train], [])

    expect(view.rows.map((row) => [row.number, row.date, row.uncovered])).toEqual([
      [1, '2027-01-20', false],
      [2, '2027-01-21', false],
      [3, '2027-01-22', false],
      [4, '2027-01-23', true],
    ])
    expect(view.rows[2].covers).toEqual([
      { eventId: 'train', kind: 'train', title: 'Night train', how: 'transport' },
    ])
    expect(view).toMatchObject({ lodging: 2, onTheWay: 1, uncovered: 1 })
  })

  it('uncovered night shows the alert: the count is what the banner reads', () => {
    expect(nightsView(TRIP, [], []).uncovered).toBe(4)
  })
})
