import vine from '@vinejs/vine'
import {
  PHRASE_CARD_CATEGORIES,
  PHRASE_CARD_PREFERENCE_MAX_LENGTH,
  PHRASE_CARD_PREFERENCES_MAX,
  PHRASE_CARD_TEXT_MAX,
  PHRASE_CARDS_MAX,
  PHRASE_CARDS_MIN,
} from '@monkitrips/shared'
import { LANGUAGE_TAG_PATTERN } from '#domain/language_tag'

/** Body of `POST /trips/:tripId/phrase-cards`: a BCP 47 tag and optional food preferences. */
export const generatePhraseCardsValidator = vine.compile(
  vine.object({
    language: vine.string().trim().maxLength(35).regex(LANGUAGE_TAG_PATTERN),
    preferences: vine
      .array(vine.string().trim().minLength(1).maxLength(PHRASE_CARD_PREFERENCE_MAX_LENGTH))
      .maxLength(PHRASE_CARD_PREFERENCES_MAX)
      .optional(),
  })
)

/** `?force=true` replaces the live set of that language instead of answering 409. */
export const phraseCardsQueryValidator = vine.compile(
  vine.object({ force: vine.boolean().optional() })
)

/**
 * Card text is shown to people as plain text: no control characters (a
 * line break is the one exception) and no bidi embeddings, overrides or
 * isolates (U+202A–202E, U+2066–2069), which can make a phrase display
 * something other than what it says.
 */
export const CARD_TEXT_PATTERN = /^(?:\n|[^\p{Cc}\u202A-\u202E\u2066-\u2069])*$/u

const cardText = vine
  .string()
  .trim()
  .minLength(1)
  .maxLength(PHRASE_CARD_TEXT_MAX)
  .regex(CARD_TEXT_PATTERN)
const optionalCardText = vine
  .string()
  .trim()
  .maxLength(PHRASE_CARD_TEXT_MAX)
  .regex(CARD_TEXT_PATTERN)
  .nullable()
  .optional()

/**
 * What the model must answer. Anything else (another shape, an unknown
 * category, an oversized text, a control or bidi character) is sent back
 * once and then refused (422).
 */
export const phraseCardsOutputValidator = vine.compile(
  vine.object({
    cards: vine
      .array(
        vine.object({
          category: vine.enum(PHRASE_CARD_CATEGORIES),
          prompt: cardText,
          phrase: cardText.clone(),
          romanization: optionalCardText,
          note: optionalCardText.clone(),
        })
      )
      .minLength(PHRASE_CARDS_MIN)
      .maxLength(PHRASE_CARDS_MAX),
  })
)
