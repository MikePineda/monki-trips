import {
  PHRASE_CARD_CATEGORIES,
  type PhraseCard,
  type PhraseCardCategory,
  type PhraseCards,
} from '@monkitrips/shared'
import type { PhraseCardRecord } from './records'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** One card as the device shows it, or null when the row holds something it cannot show. */
function toCard(value: unknown): PhraseCard | null {
  if (!isRecord(value)) {
    return null
  }
  const category = value['category']
  const prompt = value['prompt']
  const phrase = value['phrase']
  if (
    typeof category !== 'string' ||
    !PHRASE_CARD_CATEGORIES.includes(category as PhraseCardCategory) ||
    typeof prompt !== 'string' ||
    typeof phrase !== 'string' ||
    phrase.trim() === ''
  ) {
    return null
  }
  return {
    category: category as PhraseCardCategory,
    prompt,
    phrase,
    romanization: optionalText(value['romanization']),
    note: optionalText(value['note']),
  }
}

/**
 * The device's row for one language's phrase cards. Pure. The wire types
 * `cards` loosely (`unknown[]`), so every card is checked here and one the
 * screen cannot show is dropped instead of breaking the list.
 */
export function toPhraseCardRecord(row: PhraseCards): PhraseCardRecord {
  return {
    id: row.id,
    tripId: row.tripId,
    language: row.language,
    cards: row.cards.map(toCard).filter((card): card is PhraseCard => card !== null),
    updatedAt: row.updatedAt,
  }
}
