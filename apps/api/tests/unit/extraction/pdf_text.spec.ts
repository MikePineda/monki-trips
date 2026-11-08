import { test } from '@japa/runner'
import { readPdfText } from '#services/assistant/extraction/pdf_text'
import { FERRY_BOOKING_LINES, syntheticPdf } from '#tests/helpers/synthetic_pdf'

test.group('PDF text', () => {
  test('reads the text layer of a pdf page by page', async ({ assert }) => {
    const result = await readPdfText(syntheticPdf([FERRY_BOOKING_LINES, ['Page two']]), {
      maxPages: 10,
      maxChars: 20_000,
    })

    assert.equal(result.pages, 2)
    assert.include(result.text, 'Booking reference: TEST01')
    assert.include(result.text, 'Page two')
    assert.isFalse(result.truncated)
  })

  test('reads at most the first pages and characters it is allowed', async ({ assert }) => {
    const pdf = syntheticPdf([['First page text'], ['Second page text'], ['Third page text']])

    const result = await readPdfText(pdf, { maxPages: 2, maxChars: 20 })

    assert.equal(result.pages, 3)
    assert.isAtMost(result.text.length, 20)
    assert.notInclude(result.text, 'Third')
    assert.isTrue(result.truncated)
  })

  test('a scanned pdf has no text to read', async ({ assert }) => {
    const result = await readPdfText(syntheticPdf([null]), { maxPages: 10, maxChars: 20_000 })

    assert.equal(result.pages, 1)
    assert.equal(result.text.trim(), '')
  })

  test('a broken pdf reads as no text and an unknown page count', async ({ assert }) => {
    const result = await readPdfText(Buffer.from('%PDF-1.4\nnot really\n%%EOF'), {
      maxPages: 10,
      maxChars: 20_000,
    })

    assert.equal(result.text, '')
    assert.isNull(result.pages)
  })
})
