import type { PhraseCards } from '@monkitrips/shared'
import { toPhraseCardRecord } from './phrase-card-record'

function wireRow(cards: unknown[]): PhraseCards {
  return {
    id: 'set-1',
    tripId: 'trip-1',
    language: 'th',
    cards,
    model: 'fake-phrase-model',
    createdBy: 'local-traveller',
    deletedAt: null,
    updatedAt: '2026-11-07T10:00:00.000Z',
  }
}

describe('toPhraseCardRecord', () => {
  it('keeps the set of one language with its cards as the server wrote them', () => {
    const record = toPhraseCardRecord(
      wireRow([
        {
          category: 'greetings',
          prompt: 'Hello',
          phrase: 'สวัสดี',
          romanization: 'sawatdee',
          note: null,
        },
      ])
    )

    expect(record).toEqual({
      id: 'set-1',
      tripId: 'trip-1',
      language: 'th',
      cards: [
        {
          category: 'greetings',
          prompt: 'Hello',
          phrase: 'สวัสดี',
          romanization: 'sawatdee',
          note: null,
        },
      ],
      updatedAt: '2026-11-07T10:00:00.000Z',
    })
  })

  it('drops a card the device cannot show (unknown category, no phrase) and keeps the rest', () => {
    const record = toPhraseCardRecord(
      wireRow([
        { category: 'smalltalk', prompt: 'Nice weather', phrase: 'x', romanization: null },
        { category: 'food', prompt: 'No pork', phrase: '' },
        'not a card',
        { category: 'numbers', prompt: 'How much?', phrase: 'เท่าไหร่', romanization: 7 },
      ])
    )

    expect(record.cards).toEqual([
      {
        category: 'numbers',
        prompt: 'How much?',
        phrase: 'เท่าไหร่',
        romanization: null,
        note: null,
      },
    ])
  })
})
