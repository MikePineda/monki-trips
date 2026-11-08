import type { PhraseCard } from '@monkitrips/shared'
import { cardByKey, groupPhraseCards, phraseCardKey } from './phrase-card-groups'

const card = (category: PhraseCard['category'], prompt: string): PhraseCard => ({
  category,
  prompt,
  phrase: `${prompt} (local)`,
  romanization: null,
  note: null,
})

describe('phrase card groups', () => {
  const cards = [
    card('food', 'No pork'),
    card('greetings', 'Hello'),
    card('food', 'Not spicy'),
    card('numbers', 'How much?'),
  ]

  it('groups by category in the contract order and keeps the order inside a group', () => {
    const groups = groupPhraseCards('set-1', cards)

    expect(groups.map((group) => group.category)).toEqual(['greetings', 'food', 'numbers'])
    expect(groups[1]?.cards).toEqual([
      { key: 'set-1:0', card: cards[0] },
      { key: 'set-1:2', card: cards[2] },
    ])
  })

  it('finds a card again by its key, and nothing for a stale key', () => {
    const sets = [{ id: 'set-1', cards }]

    expect(cardByKey(sets, phraseCardKey('set-1', 3))?.prompt).toBe('How much?')
    expect(cardByKey(sets, 'set-1:9')).toBeNull()
    expect(cardByKey(sets, 'old-set:0')).toBeNull()
    expect(cardByKey(sets, 'garbage')).toBeNull()
    expect(cardByKey(sets, null)).toBeNull()
  })
})
