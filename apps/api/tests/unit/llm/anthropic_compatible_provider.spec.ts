import { test } from '@japa/runner'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { AnthropicCompatibleProvider } from '#services/llm/anthropic_compatible_provider'
import { LlmUnavailableError, type LlmDelta } from '#services/llm/llm_provider'

/** One request the local fake endpoint received. */
interface Received {
  method: string
  path: string
  headers: IncomingMessage['headers']
  body: any
}

type Handler = (received: Received, response: ServerResponse) => void

/** A Messages API stand-in on 127.0.0.1: answers each request with the next handler (the last repeats). */
async function fakeEndpoint(handlers: Handler[]) {
  const received: Received[] = []
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      const entry: Received = {
        method: request.method ?? '',
        path: request.url ?? '',
        headers: request.headers,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'),
      }
      received.push(entry)
      handlers[Math.min(received.length - 1, handlers.length - 1)](entry, response)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

const json =
  (status: number, body: unknown): Handler =>
  (_received, response) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }

const okMessage = {
  id: 'msg_fake',
  type: 'message',
  role: 'assistant',
  model: 'fake-model-1',
  content: [
    { type: 'text', text: 'Booked.' },
    { type: 'tool_use', id: 'toolu_1', name: 'create_task', input: { title: 'Print tickets' } },
  ],
  stop_reason: 'tool_use',
  usage: { input_tokens: 120, output_tokens: 30 },
}

const request = {
  purpose: 'chat' as const,
  system: 'You help with a trip.',
  messages: [{ role: 'user' as const, content: 'Remind me to print the tickets' }],
  tools: [
    {
      name: 'create_task',
      description: 'Drafts a task',
      inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
    },
  ],
  maxTokens: 1024,
  temperature: 0.2,
}

const noWait = async () => {}

test.group('Anthropic compatible provider', () => {
  test('anthropic compatible provider sends the messages api shape', async ({ assert }) => {
    const endpoint = await fakeEndpoint([json(200, okMessage)])
    try {
      const provider = new AnthropicCompatibleProvider({
        baseUrl: `${endpoint.baseUrl}/`,
        apiKey: 'test-key-not-real',
        model: 'text-model',
      })

      const completion = await provider.complete(request)

      const [sent] = endpoint.received
      assert.equal(sent.method, 'POST')
      assert.equal(sent.path, '/v1/messages')
      assert.equal(sent.headers['x-api-key'], 'test-key-not-real')
      assert.equal(sent.headers['anthropic-version'], '2023-06-01')
      assert.equal(sent.headers['content-type'], 'application/json')
      assert.deepEqual(sent.body, {
        model: 'text-model',
        max_tokens: 1024,
        system: 'You help with a trip.',
        messages: [{ role: 'user', content: 'Remind me to print the tickets' }],
        tools: [
          {
            name: 'create_task',
            description: 'Drafts a task',
            input_schema: { type: 'object', properties: { title: { type: 'string' } } },
          },
        ],
        tool_choice: { type: 'auto' },
        temperature: 0.2,
      })
      assert.deepEqual(completion, {
        content: 'Booked.',
        toolCalls: [{ id: 'toolu_1', name: 'create_task', input: { title: 'Print tickets' } }],
        usage: { inputTokens: 120, outputTokens: 30 },
        model: 'fake-model-1',
        stopReason: 'tool_use',
      })
    } finally {
      await endpoint.close()
    }
  })

  test('vision model is used for image inputs', async ({ assert }) => {
    const endpoint = await fakeEndpoint([json(200, okMessage)])
    try {
      const provider = new AnthropicCompatibleProvider({
        baseUrl: endpoint.baseUrl,
        apiKey: 'k',
        model: 'text-model',
        visionModel: 'vision-model',
      })

      await provider.complete({ ...request, tools: undefined })
      await provider.complete({
        ...request,
        tools: undefined,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' },
              { type: 'text', text: 'What does this booking say?' },
            ],
          },
        ],
      })

      const [textOnly, withImage] = endpoint.received
      assert.equal(textOnly.body.model, 'text-model')
      assert.notProperty(textOnly.body, 'tools')
      assert.equal(withImage.body.model, 'vision-model')
      assert.deepEqual(withImage.body.messages[0].content[0], {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' },
      })
    } finally {
      await endpoint.close()
    }
  })

  test('without a vision model an image goes to the main model', ({ assert }) => {
    const provider = new AnthropicCompatibleProvider({ apiKey: 'k', model: 'text-model' })

    const model = provider.modelFor({
      messages: [
        { role: 'user', content: [{ type: 'image', mimeType: 'image/jpeg', data: 'AA==' }] },
      ],
    })

    assert.equal(model, 'text-model')
  })

  test('retries 429 and 5xx with backoff, then answers', async ({ assert }) => {
    const endpoint = await fakeEndpoint([
      json(429, { type: 'error', error: { type: 'rate_limit_error' } }),
      json(529, { type: 'error', error: { type: 'overloaded_error' } }),
      json(200, okMessage),
    ])
    const waits: number[] = []
    try {
      const provider = new AnthropicCompatibleProvider({
        baseUrl: endpoint.baseUrl,
        apiKey: 'k',
        model: 'text-model',
        retryDelaysMs: [10, 20],
        sleep: async (ms) => {
          waits.push(ms)
        },
      })

      const completion = await provider.complete(request)

      assert.equal(completion.content, 'Booked.')
      assert.lengthOf(endpoint.received, 3)
      assert.deepEqual(waits, [10, 20])
    } finally {
      await endpoint.close()
    }
  })

  test('provider errors map to unavailable without retrying a 4xx', async ({ assert }) => {
    const endpoint = await fakeEndpoint([json(401, { type: 'error' })])
    try {
      const provider = new AnthropicCompatibleProvider({
        baseUrl: endpoint.baseUrl,
        apiKey: 'wrong',
        model: 'text-model',
        sleep: noWait,
      })

      await assert.rejects(() => provider.complete(request), LlmUnavailableError as any)
      assert.lengthOf(endpoint.received, 1)
    } finally {
      await endpoint.close()
    }
  })

  test('a 5xx that never recovers and an unreachable host map to unavailable', async ({
    assert,
  }) => {
    const endpoint = await fakeEndpoint([json(500, { type: 'error' })])
    try {
      const failing = new AnthropicCompatibleProvider({
        baseUrl: endpoint.baseUrl,
        apiKey: 'k',
        model: 'm',
        retryDelaysMs: [1, 1],
        sleep: noWait,
      })
      await assert.rejects(() => failing.complete(request), LlmUnavailableError as any)
      assert.lengthOf(endpoint.received, 3)
    } finally {
      await endpoint.close()
    }

    const unreachable = new AnthropicCompatibleProvider({
      baseUrl: endpoint.baseUrl,
      apiKey: 'k',
      model: 'm',
      retryDelaysMs: [],
      sleep: noWait,
    })
    await assert.rejects(() => unreachable.complete(request), LlmUnavailableError as any)
  })

  test('a request past the timeout maps to unavailable', async ({ assert }) => {
    const endpoint = await fakeEndpoint([() => {}])
    try {
      const provider = new AnthropicCompatibleProvider({
        baseUrl: endpoint.baseUrl,
        apiKey: 'k',
        model: 'm',
        timeoutMs: 50,
        retryDelaysMs: [],
      })
      await assert.rejects(() => provider.complete(request), LlmUnavailableError as any)
    } finally {
      endpoint.received.length = 0
      await endpoint.close().catch(() => undefined)
    }
  }).timeout(5000)

  test('streams text and tool calls from server-sent events', async ({ assert }) => {
    const events = [
      [
        'message_start',
        {
          type: 'message_start',
          message: { model: 'fake-model-1', usage: { input_tokens: 50, output_tokens: 1 } },
        },
      ],
      [
        'content_block_start',
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      ],
      [
        'content_block_delta',
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'On ' } },
      ],
      [
        'content_block_delta',
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'it.' } },
      ],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      [
        'content_block_start',
        {
          type: 'content_block_start',
          index: 1,
          content_block: { type: 'tool_use', id: 'toolu_9', name: 'create_task', input: {} },
        },
      ],
      [
        'content_block_delta',
        {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'input_json_delta', partial_json: '{"title":' },
        },
      ],
      [
        'content_block_delta',
        {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'input_json_delta', partial_json: '"Print"}' },
        },
      ],
      ['content_block_stop', { type: 'content_block_stop', index: 1 }],
      [
        'message_delta',
        { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 25 } },
      ],
      ['message_stop', { type: 'message_stop' }],
    ] as const
    const endpoint = await fakeEndpoint([
      (_received, response) => {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        for (const [name, data] of events) {
          response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
        }
        response.end()
      },
    ])
    try {
      const provider = new AnthropicCompatibleProvider({
        baseUrl: endpoint.baseUrl,
        apiKey: 'k',
        model: 'text-model',
      })

      const deltas: LlmDelta[] = []
      for await (const delta of provider.stream(request)) deltas.push(delta)

      assert.isTrue(endpoint.received[0].body.stream)
      assert.equal(endpoint.received[0].headers.accept, 'text/event-stream')
      assert.deepEqual(deltas, [
        { type: 'text', text: 'On ' },
        { type: 'text', text: 'it.' },
        {
          type: 'tool_call',
          toolCall: { id: 'toolu_9', name: 'create_task', input: { title: 'Print' } },
        },
        {
          type: 'done',
          completion: {
            content: 'On it.',
            toolCalls: [{ id: 'toolu_9', name: 'create_task', input: { title: 'Print' } }],
            usage: { inputTokens: 50, outputTokens: 25 },
            model: 'fake-model-1',
            stopReason: 'tool_use',
          },
        },
      ])
    } finally {
      await endpoint.close()
    }
  })
})
