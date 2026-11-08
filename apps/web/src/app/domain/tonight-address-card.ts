import type { PhraseCard } from '@monkitrips/shared'
import { phraseCardKey } from './phrase-card-groups'

interface CardSet {
  id: string
  language: string
  cards: readonly PhraseCard[]
}

interface TonightPlace {
  title: string
  placeName: string | null
  address: string | null
  addressLocal: string | null
}

function squash(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * The key of the "take me to this address" card of tonight's stay, for
 * Today's "Show to driver". A card does not point at its lodging, so the
 * match goes by text: the card that quotes tonight's local address, its
 * address or the place's name; else the only address card of the set. The
 * set in the language of the day's country comes first. Null when no card
 * fits (no cards yet, or several stays and none quoted). Pure.
 */
export function tonightAddressCard(
  sets: readonly CardSet[],
  tonight: TonightPlace,
  language: string | null
): string | null {
  const ordered = [...sets].sort(
    (a, b) => Number(b.language === language) - Number(a.language === language)
  )
  const needles = [tonight.addressLocal, tonight.address, tonight.placeName ?? tonight.title]
    .filter((text): text is string => typeof text === 'string' && text.trim().length >= 3)
    .map(squash)
  for (const set of ordered) {
    const lodging = set.cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.category === 'lodging_address')
    const quoted = lodging.find(({ card }) => {
      const text = squash([card.phrase, card.prompt, card.note ?? ''].join(' '))
      return needles.some((needle) => text.includes(needle))
    })
    const match = quoted ?? (lodging.length === 1 ? lodging[0] : undefined)
    if (match) {
      return phraseCardKey(set.id, match.index)
    }
  }
  return null
}
