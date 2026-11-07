import { test } from '@japa/runner'
import { parseSseStream } from '#services/llm/sse'

/** An endless event stream that counts how often its consumer cancelled it. */
function endlessStream(): { body: ReadableStream<Uint8Array>; cancelled: () => number } {
  const encoder = new TextEncoder()
  let cancels = 0
  let n = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      n += 1
      controller.enqueue(encoder.encode(`event: ping\ndata: ${n}\n\n`))
    },
    cancel() {
      cancels += 1
    },
  })
  return { body, cancelled: () => cancels }
}

test.group('Server-sent events reader', () => {
  test('stopping early cancels the upstream body', async ({ assert }) => {
    const { body, cancelled } = endlessStream()

    for await (const event of parseSseStream(body)) {
      assert.equal(event.data, '1')
      break
    }

    assert.equal(cancelled(), 1, 'the connection is released, not left open')
    assert.isFalse(body.locked)
  })

  test('a stream read to its end is not cancelled', async ({ assert }) => {
    let cancels = 0
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: a\n\ndata: b\n\n'))
        controller.close()
      },
      cancel() {
        cancels += 1
      },
    })

    const events: string[] = []
    for await (const event of parseSseStream(body)) events.push(event.data)

    assert.deepEqual(events, ['a', 'b'])
    assert.equal(cancels, 0)
  })
})
