import { groupDocumentsByWhen } from './document-groups'

describe('groupDocumentsByWhen', () => {
  const events = [
    { id: 'e-past', startsOn: '2027-01-02', title: 'Arrival' },
    { id: 'e-today', startsOn: '2027-01-05', title: 'Ferry' },
    { id: 'e-soon', startsOn: '2027-01-09', title: 'Museum' },
    { id: 'e-unplaced', startsOn: null, title: 'Idea' },
  ]
  const doc = (id: string, eventId: string | null) => ({ id, eventId, title: id })

  it('a document goes with its event: today, upcoming, or other (past, unplaced, trip-wide)', () => {
    const groups = groupDocumentsByWhen(
      [
        doc('d-today', 'e-today'),
        doc('d-soon', 'e-soon'),
        doc('d-past', 'e-past'),
        doc('d-unplaced', 'e-unplaced'),
        doc('d-free', null),
        doc('d-orphan', 'e-gone'),
      ],
      events,
      '2027-01-05'
    )

    expect(groups.map((group) => [group.when, group.documents.map((d) => d.id)])).toEqual([
      ['today', ['d-today']],
      ['upcoming', ['d-soon']],
      ['other', ['d-free', 'd-orphan', 'd-unplaced', 'd-past']],
    ])
  })

  it('upcoming documents come in event order, then by title', () => {
    const groups = groupDocumentsByWhen(
      [doc('b', 'e-soon'), doc('a', 'e-soon'), doc('c', 'e-today')],
      [...events, { id: 'e-later', startsOn: '2027-01-20', title: 'Flight home' }],
      '2027-01-01'
    )
    expect(groups[0].documents.map((d) => d.id)).toEqual(['c', 'a', 'b'])
  })

  it('empty groups are left out', () => {
    expect(groupDocumentsByWhen([doc('x', null)], events, '2027-01-05').map((g) => g.when)).toEqual(
      ['other']
    )
    expect(groupDocumentsByWhen([], events, '2027-01-05')).toEqual([])
  })
})
