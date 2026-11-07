import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApiEnvelope, PhraseCards } from '@monkitrips/shared'
import { PhraseCardGeneration } from '#services/phrase_card_generation'
import { generatePhraseCardsValidator, phraseCardsQueryValidator } from '#validators/phrase_cards'

/** Local-language phrase cards of a trip: list, generate once per language, delete to regenerate. Members only. */
@inject()
export default class PhraseCardsController {
  constructor(private readonly cards: PhraseCardGeneration) {}

  async index(ctx: HttpContext): Promise<ApiEnvelope<PhraseCards[]>> {
    return { data: await this.cards.list(ctx.trip) }
  }

  /** 201 with the new set; 409 `E_CONFLICT` with the existing `id` unless `?force=true`. */
  async store(ctx: HttpContext): Promise<ApiEnvelope<PhraseCards>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const body = await ctx.request.validateUsing(generatePhraseCardsValidator)
    const { force } = await phraseCardsQueryValidator.validate(ctx.request.qs(), {
      meta: undefined,
      messagesProvider: ctx.i18n.createMessagesProvider(),
    })
    const created = await this.cards.generate(user, ctx.trip, { ...body, force: force === true })
    ctx.response.status(201)
    return { data: created }
  }

  async destroy(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    await this.cards.remove(user, ctx.trip, String(ctx.params['language']))
    return ctx.response.noContent()
  }
}
