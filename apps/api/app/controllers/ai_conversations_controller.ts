import { Readable } from 'node:stream'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type {
  AiConversation,
  AiConversationDetail,
  ApiEnvelope,
  AssistantStreamEvent,
} from '@monkitrips/shared'
import { AiConversations } from '#services/assistant/ai_conversations'
import { AssistantChat } from '#services/assistant/assistant_chat'
import { chatMessageValidator, createConversationValidator } from '#validators/assistant'

/** One server-sent event: `event: <type>` and the event as JSON. */
function sse(event: AssistantStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

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
   * or `error`). The first event is awaited before any header goes out, so
   * a turn refused up front (402 over the cap, 503 provider down) answers
   * a plain JSON error with its status instead of an empty stream.
   */
  async message(ctx: HttpContext) {
    const user = ctx.auth.use('web').getUserOrFail()
    const conversation = await this.conversations.find(user, ctx.trip, String(ctx.params['id']))
    const { text } = await ctx.request.validateUsing(chatMessageValidator)
    const events = this.chat.turn({ user, trip: ctx.trip, conversation, text, i18n: ctx.i18n })
    const first = await events.next()

    async function* body() {
      try {
        if (!first.done) yield sse(first.value)
        for await (const event of events) yield sse(event)
      } finally {
        // A client that went away stops the turn: the model stream is cancelled and settled.
        await events.return(undefined)
      }
    }

    ctx.response.status(200)
    ctx.response.header('Content-Type', 'text/event-stream; charset=utf-8')
    ctx.response.header('Cache-Control', 'no-cache, no-transform')
    ctx.response.header('X-Accel-Buffering', 'no')
    ctx.response.stream(Readable.from(body()))
  }
}
