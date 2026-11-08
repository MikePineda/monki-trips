import type { AiAction, AiConversation, AiMessage } from '@monkitrips/shared'

/**
 * One assistant conversation as the device keeps it, to read offline: the
 * row of `GET …/ai/conversations` plus, once it was opened here, its
 * messages and proposals (`null` until then). Private to the member like
 * the conversation itself; the sync never touches it, and signing out
 * clears it with every other table.
 */
export interface AiConversationRecord extends AiConversation {
  messages: AiMessage[] | null
  actions: AiAction[] | null
}
