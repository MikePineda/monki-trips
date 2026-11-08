import {
  PHRASE_CARD_CATEGORIES,
  type PhraseCard,
  type PhraseCardCategory,
} from '@monkitrips/shared'

/** One card with the key that opens it in show mode (`<setId>:<index>`). */
export interface KeyedPhraseCard {
  key: string
  card: PhraseCard
}

export interface PhraseCardGroup {
  category: PhraseCardCategory
  cards: KeyedPhraseCard[]
}

/** The key of a card: its set and its place in the set, stable until the set is regenerated. */
export function phraseCardKey(setId: string, index: number): string {
  return `${setId}:${index}`
}

/** The card a key points at, or null (a regenerated set, a key from an old link). */
export function cardByKey(
  sets: readonly { id: string; cards: readonly PhraseCard[] }[],
  key: string | null | undefined
): PhraseCard | null {
  if (!key) {
    return null
  }
  const separator = key.lastIndexOf(':')
  const setId = key.slice(0, separator)
  const index = Number(key.slice(separator + 1))
  const set = sets.find((candidate) => candidate.id === setId)
  return separator > 0 && Number.isInteger(index) ? (set?.cards[index] ?? null) : null
}

/**
 * The cards of one set grouped by category, in the contract's category
 * order (greetings first), each card keeping its order inside the group.
 * Empty groups are left out. Pure.
 */
export function groupPhraseCards(setId: string, cards: readonly PhraseCard[]): PhraseCardGroup[] {
  return PHRASE_CARD_CATEGORIES.map((category) => ({
    category,
    cards: cards
      .map((card, index) => ({ key: phraseCardKey(setId, index), card }))
      .filter(({ card }) => card.category === category),
  })).filter((group) => group.cards.length > 0)
}
