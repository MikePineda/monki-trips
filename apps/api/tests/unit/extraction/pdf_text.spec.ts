import { test } from '@japa/runner'
import { PdfParseRefused, readPdfText } from '#services/assistant/extraction/pdf_text'
import { bombPdf, FERRY_BOOKING_LINES, syntheticPdf } from '#tests/helpers/synthetic_pdf'

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

  test('a pdf that takes too long to parse is refused without blocking the server', async ({
    assert,
  }) => {
    const bomb = bombPdf(80 * 1024 * 1024)
    let last = performance.now()
    let longestGap = 0
    const ticker = setInterval(() => {
      const now = performance.now()
      longestGap = Math.max(longestGap, now - last)
      last = now
    }, 10)
    let refused: unknown = null
    try {
      await readPdfText(bomb, { maxPages: 10, maxChars: 20_000, timeoutMs: 300 })
    } catch (error) {
      refused = error
    } finally {
      clearInterval(ticker)
    }

    assert.instanceOf(refused, PdfParseRefused)
    assert.isBelow(longestGap, 200, 'the event loop kept turning while the pdf was parsed')
  }).timeout(20_000)
})
