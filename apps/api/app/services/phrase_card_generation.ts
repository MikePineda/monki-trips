import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  PHRASE_CARD_CATEGORIES,
  PHRASE_CARD_NAME_PLACEHOLDER,
  PHRASE_CARDS_MAX,
  PHRASE_CARDS_MIN,
  type PhraseCard,
  type PhraseCards,
} from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import { isUniqueViolation } from '#exceptions/unique_violation'
import type Trip from '#models/trip'
import type User from '#models/user'
import { Clock } from '#services/clock'
import { PromptBuilder } from '#services/llm/prompt_builder'
import { StructuredCompletion } from '#services/llm/structured_completion'
import { phraseCardEntity } from '#services/sync/entities/read_only_entities'
import type { DbRow } from '#services/sync/entity_spec'
import { rowToWire } from '#services/sync/row_wire'
import { canonicalLanguageTag, languageDisplayName } from '#domain/language_tag'
import { phraseCardProblems } from '#domain/phrase_card_rules'
import { phraseCardsOutputValidator } from '#validators/phrase_cards'

export interface GeneratePhraseCards {
  language: string
  preferences?: string[]
  /** Replace the live set of this language instead of answering 409. */
  force?: boolean
}

/** A lodging of the trip as the prompt sees it (inside `<data>`). */
interface LodgingAddress {
  name: string | null
  address: string | null
  addressLocal: string | null
}

/**
 * Local-language phrase cards: generated once per trip and language
 * through the LLM (`StructuredCompletion`, metered and capped), stored in
 * `phrase_cards` (an S table, so every member's device pulls them and they
 * work offline) and never regenerated unless the caller deletes them or
 * passes `force`. The trip's lodging addresses and the caller's food
 * preferences reach the model only inside `<data>`; names never do (cards
 * carry the `{name}` placeholder).
 */
@inject()
export class PhraseCardGeneration {
  constructor(
    private readonly structured: StructuredCompletion,
    private readonly clock: Clock
  ) {}

  async list(trip: Trip): Promise<PhraseCards[]> {
    const rows = (await db
      .from('phrase_cards')
      .where('trip_id', trip.id)
      .whereNull('deleted_at')
      .orderBy('language', 'asc')) as DbRow[]
    return rows.map((row) => this.wire(row))
  }

  /** Generates and stores the set; 409 `E_CONFLICT` with the existing `id` unless `force`. */
  async generate(user: User, trip: Trip, input: GeneratePhraseCards): Promise<PhraseCards> {
    const language = canonicalLanguageTag(input.language)
    if (!language) throw new ApiException('E_BAD_REQUEST')
    const existing = await this.live(trip.id, language)
    if (existing && !input.force) {
      throw new ApiException('E_CONFLICT', { id: existing.id })
    }

    const lodgings = await this.lodgings(trip.id)
    const preferences = input.preferences ?? []
    const required = PHRASE_CARD_CATEGORIES.filter(
      (category) => category !== 'lodging_address' || lodgings.length > 0
    )
    const prompt = this.prompt(user, language, required, lodgings, preferences)
    const { value, model } = await this.structured.run<{ cards: PhraseCard[] }>({
      caller: { user, tripId: trip.id },
      purpose: 'phrase_cards',
      prompt,
      schema: phraseCardsOutputValidator,
      check: ({ cards }) => phraseCardProblems(cards, required),
    })
    const cards = value.cards.map((card) => ({
      category: card.category,
      prompt: card.prompt,
      phrase: card.phrase,
      romanization: card.romanization ?? null,
      note: card.note ?? null,
    }))

    const now = this.clock.now()
    try {
      const row = await db.transaction(async (trx) => {
        const current = (await trx
          .from('phrase_cards')
          .where('trip_id', trip.id)
          .where('language', language)
          .whereNull('deleted_at')
          .forUpdate()
          .first()) as DbRow | null
        if (current && !input.force) {
          throw new ApiException('E_CONFLICT', { id: current.id })
        }
        if (current) {
          await trx
            .from('phrase_cards')
            .where('id', current.id as string)
            .update({ deleted_at: now, updated_by: user.id })
          await this.activity(trx, trip.id, user.id, current.id as string, 'deleted')
        }
        const [inserted] = (await trx
          .table('phrase_cards')
          .insert({
            trip_id: trip.id,
            language,
            cards: JSON.stringify(cards),
            model,
            created_by: user.id,
            updated_by: user.id,
            field_clock: JSON.stringify({ cards: now.getTime() }),
          })
          .returning('*')) as DbRow[]
        await this.activity(trx, trip.id, user.id, inserted.id as string, 'created')
        return inserted
      })
      return this.wire(row)
    } catch (error) {
      // Two members asked for the same language at once: the loser learns the winner's id.
      if (isUniqueViolation(error)) {
        const winner = await this.live(trip.id, language)
        throw new ApiException('E_CONFLICT', winner ? { id: winner.id } : {})
      }
      throw error
    }
  }

  /** Tombstones the live set of `language` (so it can be generated again); 404 when there is none. */
  async remove(user: User, trip: Trip, rawLanguage: string): Promise<void> {
    const language = canonicalLanguageTag(rawLanguage)
    const existing = language ? await this.live(trip.id, language) : null
    if (!existing) throw new ApiException('E_ROW_NOT_FOUND')
    await db.transaction(async (trx) => {
      await trx
        .from('phrase_cards')
        .where('id', existing.id)
        .whereNull('deleted_at')
        .update({ deleted_at: this.clock.now(), updated_by: user.id })
      await this.activity(trx, trip.id, user.id, existing.id, 'deleted')
    })
  }

  private async live(tripId: string, language: string): Promise<{ id: string } | null> {
    return (await db
      .from('phrase_cards')
      .where('trip_id', tripId)
      .where('language', language)
      .whereNull('deleted_at')
      .select('id')
      .first()) as { id: string } | null
  }

  private async lodgings(tripId: string): Promise<LodgingAddress[]> {
    const rows = (await db
      .from('events')
      .where('trip_id', tripId)
      .where('kind', 'lodging')
      .whereNot('status', 'cancelled')
      .whereNull('deleted_at')
      .where((query) => query.whereNotNull('address').orWhereNotNull('address_local'))
      .orderBy('starts_at', 'asc')
      .select('place_name', 'title', 'address', 'address_local')) as DbRow[]
    return rows.map((row) => ({
      name: (row.place_name as string | null) ?? (row.title as string | null) ?? null,
      address: (row.address as string | null) ?? null,
      addressLocal: (row.address_local as string | null) ?? null,
    }))
  }

  private prompt(
    user: User,
    language: string,
    required: readonly string[],
    lodgings: LodgingAddress[],
    preferences: string[]
  ): PromptBuilder {
    const travellerLanguage = languageDisplayName(user.locale, 'en')
    const targetLanguage = languageDisplayName(language, 'en')
    const prompt = new PromptBuilder(
      'You write phrase cards a traveller shows or reads to local people. Each card pairs what ' +
        `the traveller wants to say, in ${travellerLanguage}, with the same phrase in ` +
        `${targetLanguage} (BCP 47 "${language}"), written in its usual script.`
    )
      .rule(
        `Never write a real person's name. Where a name belongs, keep the literal placeholder ` +
          `${PHRASE_CARD_NAME_PLACEHOLDER} unchanged in both "prompt" and "phrase".`
      )
      .rule(
        'Output shape: {"cards":[{"category":"...","prompt":"...","phrase":"...","romanization":"..." or null,"note":"..." or null}]}. ' +
          `Between ${PHRASE_CARDS_MIN} and ${PHRASE_CARDS_MAX} cards. Categories: ${PHRASE_CARD_CATEGORIES.join(', ')}. ` +
          'Give a romanization when the script is not Latin, else null.'
      )

    const asks = [
      `Write cards for every one of these categories: ${required.join(', ')}.`,
      '- greetings: hello, thank you, sorry, excuse me, goodbye.',
      `- reservation: "I have a reservation under ${PHRASE_CARD_NAME_PLACEHOLDER}" and checking in or out.`,
      '- food: ordering, the bill, and one card per food preference listed below (or common allergies when none are listed).',
      '- emergency: help, call an ambulance, the police, a doctor, a pharmacy, I am lost.',
      '- numbers: how much is it, numbers, prices and paying by card or cash.',
    ]
    if (lodgings.length > 0) {
      asks.push(
        '- lodging_address: one card per lodging below, "Please take me to this address" with the address in the local script as the phrase (copy it, do not invent one).'
      )
      asks.push(
        PromptBuilder.untrusted(
          'lodging addresses',
          lodgings
            .map((lodging) =>
              [lodging.name, lodging.address, lodging.addressLocal].filter(Boolean).join(' | ')
            )
            .join('\n')
        )
      )
    }
    if (preferences.length > 0) {
      asks.push(PromptBuilder.untrusted('food preferences', preferences.join('\n')))
    }
    return prompt.user(asks.join('\n'))
  }

  private async activity(
    trx: TransactionClientContract,
    tripId: string,
    userId: string,
    id: string,
    action: 'created' | 'deleted'
  ) {
    await trx.table('trip_activity').insert({
      trip_id: tripId,
      actor_user_id: userId,
      entity: 'phrase_card',
      entity_id: id,
      action,
      fields: action === 'created' ? ['language', 'cards'] : [],
    })
  }

  private wire(row: DbRow): PhraseCards {
    return rowToWire(phraseCardEntity, row) as unknown as PhraseCards
  }
}
