import { inject } from '@adonisjs/core'
import { errors as vineErrors, type VineValidator } from '@vinejs/vine'
import type { SchemaTypes } from '@vinejs/vine/types'
import { ApiException } from '#exceptions/api_exception'
import { LLM_STRUCTURED_MAX_TOKENS } from '#config/llm'
import { LlmClient, type LlmCaller } from '#services/llm/llm_client'
import type { LlmRequest } from '#services/llm/llm_provider'
import type { PromptBuilder } from '#services/llm/prompt_builder'

export interface StructuredCompletionOptions<T> {
  caller: LlmCaller
  purpose: LlmRequest['purpose']
  prompt: PromptBuilder
  schema: VineValidator<SchemaTypes, undefined>
  /** Extra checks on the validated value; each line goes back to the model on retry. */
  check?: (value: T) => string[]
  maxTokens?: number
}

export interface StructuredCompletionResult<T> {
  value: T
  model: string
  /** Calls made: 1, or 2 when the first answer was refused and the retry accepted. */
  attempts: number
}

/**
 * Asks the model for one JSON document and refuses anything else: the
 * answer is parsed (code fences and prose around the JSON tolerated),
 * validated with a VineJS schema and the caller's extra checks; an invalid
 * answer is sent back once with the problems, and a second failure answers
 * 422 `E_LLM_BAD_OUTPUT`. Both calls are metered through `LlmClient`.
 */
@inject()
export class StructuredCompletion {
  constructor(private readonly llm: LlmClient) {}

  async run<T>(options: StructuredCompletionOptions<T>): Promise<StructuredCompletionResult<T>> {
    const { prompt } = options
    prompt.rule(
      'Answer with one JSON document and nothing else: no prose before or after it, no code fences.'
    )
    const maxTokens = options.maxTokens ?? LLM_STRUCTURED_MAX_TOKENS
    let built = prompt.build()
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const completion = await this.llm.complete(options.caller, {
        purpose: options.purpose,
        ...built,
        maxTokens,
      })
      const outcome = await this.parse<T>(completion.content, options)
      if (outcome.ok) return { value: outcome.value, model: completion.model, attempts: attempt }
      if (attempt === 2) break
      prompt.assistant(completion.content || '(empty)')
      prompt.user(
        'That answer was not valid. Problems:\n' +
          outcome.problems.map((problem) => `- ${problem}`).join('\n') +
          '\nAnswer again with only the corrected JSON document.'
      )
      built = prompt.build()
    }
    throw new ApiException('E_LLM_BAD_OUTPUT')
  }

  private async parse<T>(
    content: string,
    options: StructuredCompletionOptions<T>
  ): Promise<{ ok: true; value: T } | { ok: false; problems: string[] }> {
    const json = extractJson(content)
    if (json === null) return { ok: false, problems: ['the answer is not a JSON document'] }
    try {
      const value = (await options.schema.validate(json, { meta: undefined })) as T
      const problems = options.check?.(value) ?? []
      return problems.length > 0 ? { ok: false, problems } : { ok: true, value }
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        const messages = (error as { messages: { field: string; message: string }[] }).messages
        return { ok: false, problems: messages.map((m) => `${m.field}: ${m.message}`) }
      }
      throw error
    }
  }
}

/** The first JSON object or array in `text`, parsed, or null. Tolerates code fences and surrounding prose. */
export function extractJson(text: string): unknown | null {
  const unfenced = text.replace(/```(?:json)?/gi, '')
  const start = unfenced.search(/[[{]/)
  if (start < 0) return null
  const open = unfenced[start]
  const close = open === '{' ? '}' : ']'
  const end = unfenced.lastIndexOf(close)
  if (end <= start) return null
  try {
    return JSON.parse(unfenced.slice(start, end + 1))
  } catch {
    return null
  }
}
