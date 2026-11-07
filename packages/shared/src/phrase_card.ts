/**
 * Local-language phrase cards, generated once per trip and language by the
 * LLM behind its interface and stored in `phrase_cards` (synced offline).
 * Every card pairs a phrase in the traveller's language (`prompt`) with its
 * translation (`phrase`); a card that names a person uses the literal
 * placeholder `{name}` so no real name ever reaches the model or the row.
 */
export const PHRASE_CARD_CATEGORIES = [
  'greetings',
  'reservation',
  'lodging_address',
  'food',
  'emergency',
  'numbers',
] as const

export type PhraseCardCategory = (typeof PHRASE_CARD_CATEGORIES)[number]

/** The placeholder a card uses instead of a person's name. */
export const PHRASE_CARD_NAME_PLACEHOLDER = '{name}'

export interface PhraseCard {
  category: PhraseCardCategory
  /** What the traveller wants to say, in their own language. */
  prompt: string
  /** The same in the local language and script. */
  phrase: string
  /** The phrase as it sounds, in Latin letters, or null when the script already is. */
  romanization: string | null
  /** When and how to use it, or null. */
  note: string | null
}

/** Body of `POST /trips/:tripId/phrase-cards`. */
export interface GeneratePhraseCardsInput {
  /** BCP 47 language tag of the cards (`ja`, `pt-BR`). */
  language: string
  /** Dietary needs or food preferences, in the traveller's words. */
  preferences?: string[]
}

/** Bounds of one generated set, shared by the validator and the prompt. */
export const PHRASE_CARDS_MIN = 6
export const PHRASE_CARDS_MAX = 60
export const PHRASE_CARD_TEXT_MAX = 300
export const PHRASE_CARD_PREFERENCES_MAX = 10
export const PHRASE_CARD_PREFERENCE_MAX_LENGTH = 80
