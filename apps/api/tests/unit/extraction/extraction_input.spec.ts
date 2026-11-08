import { test } from '@japa/runner'
import { EXTRACTION_MAX_IMAGE_BYTES } from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import { extractionInputOf } from '#services/assistant/extraction/extraction_input'
import { FERRY_BOOKING_LINES, syntheticPdf } from '#tests/helpers/synthetic_pdf'

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
])

async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
    return null
  } catch (error) {
    if (error instanceof ApiException) return error.code ?? null
    throw error
  }
}

test.group('Extraction input', () => {
  test('a pdf with a text layer is read as text, without the file', async ({ assert }) => {
    const input = await extractionInputOf(syntheticPdf([FERRY_BOOKING_LINES]), 'application/pdf', {
      vision: true,
    })

    assert.equal(input.source, 'text')
    assert.include(input.source === 'text' ? input.text : '', 'TEST01')
  })

  test('a scanned pdf goes to vision as a document block with its page count', async ({
    assert,
  }) => {
    const input = await extractionInputOf(syntheticPdf([null, null]), 'application/pdf', {
      vision: true,
    })

    assert.equal(input.source, 'vision')
    if (input.source !== 'vision') return
    assert.equal(input.block.type, 'document')
    assert.include(input.block, { mimeType: 'application/pdf', pages: 2 })
  })

  test('an image goes to vision as an image block', async ({ assert }) => {
    const input = await extractionInputOf(PNG, 'image/png', { vision: true })

    assert.equal(input.source, 'vision')
    if (input.source !== 'vision') return
    assert.deepEqual(input.block, {
      type: 'image',
      mimeType: 'image/png',
      data: PNG.toString('base64'),
    })
  })

  test('without vision a scan or a photo is unavailable', async ({ assert }) => {
    assert.equal(
      await codeOf(extractionInputOf(syntheticPdf([null]), 'application/pdf', { vision: false })),
      'E_EXTRACTION_UNAVAILABLE'
    )
    assert.equal(
      await codeOf(extractionInputOf(PNG, 'image/png', { vision: false })),
      'E_EXTRACTION_UNAVAILABLE'
    )
  })

  test('a scan over the page or size bound is refused as too large', async ({ assert }) => {
    const pages = Array.from({ length: 11 }, () => null)
    const big = Buffer.concat([PNG, Buffer.alloc(EXTRACTION_MAX_IMAGE_BYTES)])

    assert.equal(
      await codeOf(extractionInputOf(syntheticPdf(pages), 'application/pdf', { vision: true })),
      'E_FILE_TOO_LARGE'
    )
    assert.equal(
      await codeOf(extractionInputOf(big, 'image/png', { vision: true })),
      'E_FILE_TOO_LARGE'
    )
  })

  test('a type the model cannot read is unsupported', async ({ assert }) => {
    assert.equal(
      await codeOf(extractionInputOf(PNG, 'image/heic', { vision: true })),
      'E_UNSUPPORTED_FILE'
    )
  })
})
