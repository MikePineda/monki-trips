import {
  LLM_CHARS_PER_TOKEN,
  LLM_DOCUMENT_PAGE_TOKEN_ESTIMATE,
  LLM_IMAGE_TOKEN_ESTIMATE,
} from '#config/llm'
import type { LlmContentBlock, LlmRequest } from '#services/llm/llm_provider'

/**
 * A provider-neutral guess of a request's input tokens, made before the
 * call: one token per `LLM_CHARS_PER_TOKEN` characters of everything sent
 * (system prompt, messages, tool calls and results, tool definitions), and
 * a flat `LLM_IMAGE_TOKEN_ESTIMATE` per image and
 * `LLM_DOCUMENT_PAGE_TOKEN_ESTIMATE` per page of a PDF document block. The cap reserves it with
 * `maxTokens` before the call, and a failed call the provider did process
 * is charged with it. Rounded up; it never reads or logs the content.
 */
export function estimateInputTokens(
  request: Pick<LlmRequest, 'system' | 'messages' | 'tools'>
): number {
  let characters = request.system.length
  let images = 0
  let documentTokens = 0
  for (const message of request.messages) {
    if (typeof message.content === 'string') {
      characters += message.content.length
      continue
    }
    for (const block of message.content) {
      if (block.type === 'image') images += 1
      else if (block.type === 'document') {
        documentTokens += Math.max(1, block.pages) * LLM_DOCUMENT_PAGE_TOKEN_ESTIMATE
      } else characters += blockCharacters(block)
    }
  }
  for (const tool of request.tools ?? []) {
    characters += tool.name.length + tool.description.length
    characters += JSON.stringify(tool.inputSchema).length
  }
  return (
    Math.ceil(characters / LLM_CHARS_PER_TOKEN) + images * LLM_IMAGE_TOKEN_ESTIMATE + documentTokens
  )
}

function blockCharacters(
  block: Exclude<LlmContentBlock, { type: 'image' } | { type: 'document' }>
): number {
  switch (block.type) {
    case 'text':
      return block.text.length
    case 'tool_use':
      return block.name.length + JSON.stringify(block.input).length
    case 'tool_result':
      return block.content.length
  }
}
