import { documentsNeededToday } from './documents-needed-today'

describe('documentsNeededToday', () => {
  const events = [
    { id: 'ferry', startsOn: '2027-01-05', kind: 'ferry' as const },
    { id: 'flight', startsOn: '2027-01-06', kind: 'flight' as const },
    { id: 'museum', startsOn: '2027-01-07', kind: 'tour' as const },
  ]
  const doc = (id: string, eventId: string | null, tags: string[]) => ({
    id,
    eventId,
    tags: tags as ('print' | 'show_on_phone' | 'requires_passport')[],
  })

  it('a print or show-on-phone document of an event that starts today is needed, with why', () => {
    const needed = documentsNeededToday(
      [
        doc('voucher', 'ferry', ['print']),
        doc('qr', 'ferry', ['show_on_phone']),
        doc('untagged', 'ferry', []),
        doc('tomorrow', 'flight', ['print']),
      ],
      events,
      '2027-01-05'
    )

    expect(needed).toEqual([
      { document: doc('voucher', 'ferry', ['print']), reasons: ['print'] },
      { document: doc('qr', 'ferry', ['show_on_phone']), reasons: ['show_on_phone'] },
    ])
  })

  it('on a flight day every document that requires the passport is needed, linked or not', () => {
    const needed = documentsNeededToday(
      [doc('passport', null, ['requires_passport']), doc('visa', 'museum', ['requires_passport'])],
      events,
      '2027-01-06'
    )
    expect(needed.map((item) => item.document.id)).toEqual(['passport', 'visa'])
    expect(
      documentsNeededToday([doc('passport', null, ['requires_passport'])], events, '2027-01-05')
    ).toEqual([])
  })
})
