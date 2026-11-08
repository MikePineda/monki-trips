import { LLM_DOCUMENT_PAGE_TOKEN_ESTIMATE } from '#config/llm'
import { test } from '@japa/runner'
import { estimateInputTokens } from '#services/llm/input_token_estimate'

test.group('Input token estimate', () => {
  test('the input estimate is a token per four characters of everything sent', ({ assert }) => {
    const estimate = estimateInputTokens({
      system: 'a'.repeat(40),
      messages: [
        { role: 'user', content: 'b'.repeat(40) },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'c'.repeat(8) },
            { type: 'tool_use', id: 't1', name: 'look', input: {} },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', toolUseId: 't1', content: 'd'.repeat(8) }],
        },
      ],
    })

    // 40 + 40 + 8 + "look{}" (6) + 8 = 102 characters
    assert.equal(estimate, Math.ceil(102 / 4))
  })

  test('an image counts as a fixed block, not by its base64 size', ({ assert }) => {
    const withImage = estimateInputTokens({
      system: '',
      messages: [
        {
          role: 'user',
          content: [{ type: 'image', mimeType: 'image/png', data: 'x'.repeat(400_000) }],
        },
      ],
    })

    assert.isBelow(withImage, 5_000)
    assert.isAbove(withImage, 0)
  })

  test('a pdf document counts a fixed block per page, not by its base64 size', ({ assert }) => {
    const estimate = (pages: number) =>
      estimateInputTokens({
        system: '',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', mimeType: 'application/pdf', data: 'x'.repeat(400_000), pages },
            ],
          },
        ],
      })

    assert.equal(estimate(3), 3 * LLM_DOCUMENT_PAGE_TOKEN_ESTIMATE)
    assert.equal(estimate(0), LLM_DOCUMENT_PAGE_TOKEN_ESTIMATE)
  })
})
