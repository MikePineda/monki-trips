import type { ApiClient, ApiResponse } from '@japa/api-client'
import type { AiConversation, AssistantStreamEvent } from '@monkitrips/shared'
import type { FakeLlmFixture } from '#services/llm/fake_llm_provider'
import type { LlmToolCall } from '#services/llm/llm_provider'
import type User from '#models/user'
import { actingAs } from '#tests/helpers/acting_as'

/** `POST /trips/:tripId/ai/conversations` as `user`; returns the new conversation. */
export async function startConversation(
  client: ApiClient,
  user: User,
  tripId: string
): Promise<AiConversation> {
  const response: ApiResponse = await actingAs(
    client.post(`/api/v1/trips/${tripId}/ai/conversations`),
    user
  ).json({})
  response.assertStatus(201)
  return response.body().data
}

/** The events of a `text/event-stream` body, in order. */
export function streamEvents(response: ApiResponse): AssistantStreamEvent[] {
  const events: AssistantStreamEvent[] = []
  for (const block of response.text().split('\n\n')) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (data) events.push(JSON.parse(data))
  }
  return events
}

/** `POST …/messages` as `user`: the raw response and its parsed events. */
export async function say(
  client: ApiClient,
  user: User,
  tripId: string,
  conversationId: string,
  text: string
): Promise<{ response: ApiResponse; events: AssistantStreamEvent[] }> {
  const response: ApiResponse = await actingAs(
    client.post(`/api/v1/trips/${tripId}/ai/conversations/${conversationId}/messages`),
    user
  ).json({ text })
  const isStream = String(response.header('content-type') ?? '').startsWith('text/event-stream')
  return { response, events: isStream ? streamEvents(response) : [] }
}

/** A scripted chat: each step is one model answer, a tool call or plain text. */
export function chatScript(
  ...steps: ({ text: string } | { tool: string; input: Record<string, unknown> })[]
): FakeLlmFixture {
  return {
    model: 'fake-chat-model',
    responses: steps.map((step, index) => {
      if ('text' in step)
        return { content: step.text, usage: { inputTokens: 200, outputTokens: 20 } }
      const call: LlmToolCall = { id: `toolu_${index}`, name: step.tool, input: step.input }
      return { toolCalls: [call], usage: { inputTokens: 200, outputTokens: 30 } }
    }),
  }
}
