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

const cardText = vine.string().trim().minLength(1).maxLength(PHRASE_CARD_TEXT_MAX)

/**
 * What the model must answer. Anything else (another shape, an unknown
 * category, an oversized text) is sent back once and then refused (422).
 */
export const phraseCardsOutputValidator = vine.compile(
  vine.object({
    cards: vine
      .array(
        vine.object({
          category: vine.enum(PHRASE_CARD_CATEGORIES),
          prompt: cardText,
          phrase: cardText.clone(),
          romanization: vine.string().trim().maxLength(PHRASE_CARD_TEXT_MAX).nullable().optional(),
          note: vine.string().trim().maxLength(PHRASE_CARD_TEXT_MAX).nullable().optional(),
        })
      )
      .minLength(PHRASE_CARDS_MIN)
      .maxLength(PHRASE_CARDS_MAX),
  })
)
