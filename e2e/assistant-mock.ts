import type { Page } from '@playwright/test'

/** The id of the conversation `mockAssistantConversation` answers for. */
export const MOCK_CONVERSATION_ID = '00000000-0000-4000-8000-00000000c0de'

/**
 * Answers `GET …/ai/conversations/<MOCK_CONVERSATION_ID>` of the trip with
 * a synthetic conversation: one question, Kiko's answer over two lines and
 * one open proposal that moves an invented day trip by a day, so a night
 * loses its bed and the next gains one. The screens that only need to show
 * a chat with an open proposal (the accessibility audit, the narrow-screen
 * checks, the screenshots) use it instead of the fake LLM, whose scripted
 * answers are one sequence for the whole run (J18 owns it). Nothing here
 * is a real place or booking.
 */
export async function mockAssistantConversation(page: Page, tripId: string): Promise<string> {
  const now = new Date()
  const iso = now.toISOString()
  const expires = new Date(now.getTime() + 12 * 3_600_000).toISOString()
  const detail = {
    id: MOCK_CONVERSATION_ID,
    tripId,
    title: 'Move the day trip',
    createdAt: iso,
    updatedAt: iso,
    messages: [
      {
        id: 'mock-msg-1',
        conversationId: MOCK_CONVERSATION_ID,
        role: 'user',
        content: 'Move the day trip to Thursday and tell me what shifts',
        createdAt: iso,
      },
      {
        id: 'mock-msg-2',
        conversationId: MOCK_CONVERSATION_ID,
        role: 'assistant',
        content:
          'Moving the island day trip to Thursday frees Wednesday.\nOne night loses its bed: check it before you accept.',
        createdAt: iso,
      },
    ],
    actions: [
      {
        id: 'mock-action-1',
        tripId,
        conversationId: MOCK_CONVERSATION_ID,
        messageId: 'mock-msg-2',
        tool: 'propose_event_changes',
        status: 'proposed',
        proposal: {
          kind: 'event_changes',
          summary: 'Move the island day trip to Thursday',
          events: [
            {
              op: 'move',
              eventId: 'mock-event-1',
              kind: 'tour',
              title: 'Island day trip with a very long name that has to wrap on a narrow phone',
              status: 'booked',
              fields: [
                { field: 'startsLocal', before: '2030-05-15T08:30', after: '2030-05-16T08:30' },
                { field: 'endsLocal', before: '2030-05-15T18:00', after: '2030-05-16T18:00' },
              ],
            },
          ],
          nights: [
            {
              date: '2030-05-15',
              before: { eventId: 'mock-stay-1', title: 'Demo Harbour Guesthouse' },
              after: null,
            },
            {
              date: '2030-05-16',
              before: null,
              after: { eventId: 'mock-stay-1', title: 'Demo Harbour Guesthouse' },
            },
          ],
          uncoveredBefore: 1,
          uncoveredAfter: 1,
        },
        expiresAt: expires,
        decidedAt: null,
        errorCode: null,
        createdAt: iso,
      },
    ],
  }
  await page.route(
    `**/api/v1/trips/${tripId}/ai/conversations/${MOCK_CONVERSATION_ID}`,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback()
        return
      }
      await route.fulfill({ json: { data: detail } })
    }
  )
  return `/t/${tripId}/more/assistant/${MOCK_CONVERSATION_ID}`
}
