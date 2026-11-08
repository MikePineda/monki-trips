import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { AiConversation, AiConversationDetail, ApiEnvelope } from '@monkitrips/shared'
import { AiConversations } from '#services/assistant/ai_conversations'
import { AssistantChat } from '#services/assistant/assistant_chat'
import { assistantEventStream } from '#services/assistant/assistant_sse'
import { chatMessageValidator, createConversationValidator } from '#validators/assistant'

/**
 * The member's own conversations with the trip assistant. Members only
 * (`tripMember`); a conversation of another account, even of a member of
 * the same trip, answers 404.
 */
@inject()
export default class AiConversationsController {
  constructor(
    private readonly conversations: AiConversations,
    private readonly chat: AssistantChat
  ) {}

  async index(ctx: HttpContext): Promise<ApiEnvelope<AiConversation[]>> {
    const user = ctx.auth.use('web').getUserOrFail()
    return { data: await this.conversations.list(user, ctx.trip) }
  }

  async store(ctx: HttpContext): Promise<ApiEnvelope<AiConversation>> {
    const user = ctx.auth.use('web').getUserOrFail()
    const { title } = await ctx.request.validateUsing(createConversationValidator)
    ctx.response.status(201)
    return { data: await this.conversations.create(user, ctx.trip, title ?? null) }
  }

  async show(ctx: HttpContext): Promise<ApiEnvelope<AiConversationDetail>> {
    const user = ctx.auth.use('web').getUserOrFail()
    return { data: await this.conversations.detail(user, ctx.trip, String(ctx.params['id'])) }
  }

  async destroy(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    await this.conversations.destroy(user, ctx.trip, String(ctx.params['id']))
    return ctx.response.noContent()
  }

  /**
   * One chat turn as `text/event-stream` (`text`, `proposal`, then `done`
   * or `error`). The first model call is reserved before any header goes
   * out, so a turn refused up front (402 over the cap) answers a plain JSON
   * error with its status; from then on the headers are sent at once and
   * every failure arrives as an `error` event. A client that goes away
   * aborts the turn.
   */
  async message(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    const conversation = await this.conversations.find(user, ctx.trip, String(ctx.params['id']))
    const { text } = await ctx.request.validateUsing(chatMessageValidator)
    const aborter = new AbortController()
    const events = await this.chat.start({
      user,
      trip: ctx.trip,
      conversation,
      text,
      i18n: ctx.i18n,
      signal: aborter.signal,
    })

    ctx.response.status(200)
    ctx.response.header('Content-Type', 'text/event-stream; charset=utf-8')
    ctx.response.header('Cache-Control', 'no-cache')
    ctx.response.header('X-Accel-Buffering', 'no')
    ctx.response.stream(assistantEventStream(events, { aborter }))
  }
}
