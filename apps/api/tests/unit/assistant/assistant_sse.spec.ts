import { test } from '@japa/runner'
import type { AssistantStreamEvent } from '@monkitrips/shared'
import { assistantEventStream } from '#services/assistant/assistant_sse'

async function read(stream: NodeJS.ReadableStream): Promise<string> {
  let text = ''
  for await (const chunk of stream) text += chunk.toString()
  return text
}

async function* slowEvents(): AsyncGenerator<AssistantStreamEvent> {
  yield { type: 'text', text: 'Hi' }
  await new Promise((resolve) => setTimeout(resolve, 60))
  yield { type: 'done', conversationId: 'c', messageId: 'm', title: null }
}

test.group('Assistant SSE', () => {
  test('each event is written as event and data lines', async ({ assert }) => {
    const stream = assistantEventStream(slowEvents(), { pingMs: 10_000 })

    assert.equal(
      await read(stream),
      'event: text\ndata: {"type":"text","text":"Hi"}\n\n' +
        'event: done\ndata: {"type":"done","conversationId":"c","messageId":"m","title":null}\n\n'
    )
  })

  test('a ping comment keeps a quiet stream open', async ({ assert }) => {
    const stream = assistantEventStream(slowEvents(), { pingMs: 15 })

    const text = await read(stream)

    assert.include(text, ': ping\n\n')
    assert.isTrue(text.endsWith('"title":null}\n\n'))
  })

  test('closing the stream aborts the turn and stops reading events', async ({ assert }) => {
    const aborter = new AbortController()
    let finished = false
    async function* endless(): AsyncGenerator<AssistantStreamEvent> {
      try {
        for (;;) {
          yield { type: 'text', text: 'more ' }
          await new Promise((resolve) => setTimeout(resolve, 5))
        }
      } finally {
        finished = true
      }
    }
    const stream = assistantEventStream(endless(), { pingMs: 10_000, aborter })

    await new Promise((resolve) => setTimeout(resolve, 20))
    stream.destroy()
    await new Promise((resolve) => setTimeout(resolve, 30))

    assert.isTrue(aborter.signal.aborted)
    assert.isTrue(finished, 'the event generator was closed')
  })
})
