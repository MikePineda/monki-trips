import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LlmPurpose } from '@monkitrips/shared'
import {
  LlmProvider,
  LlmUnavailableError,
  type LlmCompletion,
  type LlmDelta,
  type LlmRequest,
  type LlmStreamOptions,
  type LlmToolCall,
} from '#services/llm/llm_provider'

/**
 * One fixture file: the answers the fake gives, in order, to the calls of
 * one purpose and case. The last answer repeats once the list is used up.
 * `toolCalls` makes a scripted tool call; `error` makes the call fail like
 * a provider outage.
 */
export interface FakeLlmFixture {
  model?: string
  responses: FakeLlmResponse[]
}

export interface FakeLlmResponse {
  content?: string
  toolCalls?: LlmToolCall[]
  usage?: { inputTokens: number; outputTokens: number }
  /** Fail this call instead of answering. */
  error?: string
}

/**
 * `LLM_PROVIDER=fake`: answers from `tests/fixtures/llm/<purpose>/<case>.json`
 * (`default.json` unless a test picks a case), records every request for
 * assertions and streams text in word-sized chunks so a consumer sees more
 * than one delta. The fixtures never ship in the image, so a production
 * deployment left on `fake` answers 503 instead of inventing text.
 */
export class FakeLlmProvider extends LlmProvider {
  readonly name = 'fake'
  /** Every request received, in order. */
  readonly calls: LlmRequest[] = []
  private readonly cases = new Map<LlmPurpose, string>()
  private readonly cursor = new Map<string, number>()
  private readonly fixtures = new Map<string, FakeLlmFixture>()

  constructor(private readonly fixturesDir: string) {
    super()
  }

  /** Answer the next calls of `purpose` from `<purpose>/<name>.json`, starting from its first response. */
  useCase(purpose: LlmPurpose, name: string): this {
    this.cases.set(purpose, name)
    this.cursor.delete(`${purpose}/${name}`)
    return this
  }

  /** Queue a scripted fixture without a file (a test that needs a one-off answer). */
  script(purpose: LlmPurpose, name: string, fixture: FakeLlmFixture): this {
    this.fixtures.set(`${purpose}/${name}`, fixture)
    return this.useCase(purpose, name)
  }

  async complete(request: LlmRequest): Promise<LlmCompletion> {
    this.calls.push(request)
    const { fixture, response } = await this.next(request.purpose)
    if (response.error) throw new LlmUnavailableError(response.error)
    return this.completionOf(fixture, response)
  }

  async *stream(request: LlmRequest, options: LlmStreamOptions = {}): AsyncIterable<LlmDelta> {
    this.calls.push(request)
    const { fixture, response } = await this.next(request.purpose)
    if (response.error) throw new LlmUnavailableError(response.error)
    const completion = this.completionOf(fixture, response)
    // Like a real provider, the input is known when the answer starts.
    options.onUsage?.(
      { inputTokens: completion.usage.inputTokens, outputTokens: 0 },
      completion.model
    )
    for (const chunk of completion.content.match(/\S+\s*|\s+/g) ?? []) {
      yield { type: 'text', text: chunk }
    }
    for (const toolCall of completion.toolCalls) {
      yield { type: 'tool_call', toolCall }
    }
    yield { type: 'done', completion }
  }

  private completionOf(fixture: FakeLlmFixture, response: FakeLlmResponse): LlmCompletion {
    const toolCalls = response.toolCalls ?? []
    return {
      content: response.content ?? '',
      toolCalls,
      usage: response.usage ?? { inputTokens: 100, outputTokens: 50 },
      model: fixture.model ?? 'fake-model',
      stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
    }
  }

  private async next(
    purpose: LlmPurpose
  ): Promise<{ fixture: FakeLlmFixture; response: FakeLlmResponse }> {
    const name = this.cases.get(purpose) ?? 'default'
    const key = `${purpose}/${name}`
    const fixture = await this.load(key)
    if (fixture.responses.length === 0) {
      throw new LlmUnavailableError(`fake llm fixture ${key} has no responses`)
    }
    const index = this.cursor.get(key) ?? 0
    this.cursor.set(key, index + 1)
    return { fixture, response: fixture.responses[Math.min(index, fixture.responses.length - 1)] }
  }

  private async load(key: string): Promise<FakeLlmFixture> {
    const cached = this.fixtures.get(key)
    if (cached) return cached
    let text: string
    try {
      text = await readFile(join(this.fixturesDir, `${key}.json`), 'utf8')
    } catch {
      throw new LlmUnavailableError(`fake llm fixture ${key} is not available`)
    }
    const fixture = JSON.parse(text) as FakeLlmFixture
    this.fixtures.set(key, fixture)
    return fixture
  }
}
