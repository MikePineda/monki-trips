import vine from '@vinejs/vine'
import { AI_CONVERSATION_TITLE_LENGTH, ASSISTANT_MESSAGE_MAX_LENGTH } from '@monkitrips/shared'

/** Body of `POST /trips/:tripId/ai/conversations`: an optional title (else the first message names it). */
export const createConversationValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(AI_CONVERSATION_TITLE_LENGTH).optional(),
  })
)

/** Body of `POST …/ai/conversations/:id/messages`: what the member says. */
export const chatMessageValidator = vine.compile(
  vine.object({
    text: vine.string().trim().minLength(1).maxLength(ASSISTANT_MESSAGE_MAX_LENGTH),
  })
)
