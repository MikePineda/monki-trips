import { test } from '@japa/runner'
import {
  contentDispositionFor,
  documentStorageKey,
  isAllowedDocumentMime,
} from '#domain/document_files'

test.group('Document files', () => {
  test('only PDFs and images are allowed, by sniffed type', ({ assert }) => {
    assert.isTrue(isAllowedDocumentMime('application/pdf'))
    assert.isTrue(isAllowedDocumentMime('image/jpeg'))
    assert.isFalse(isAllowedDocumentMime('application/x-msdownload'))
    assert.isFalse(isAllowedDocumentMime('text/html'))
    assert.isFalse(isAllowedDocumentMime(undefined))
  })

  test('images and PDFs open inline, everything else downloads', ({ assert }) => {
    assert.equal(
      contentDispositionFor('application/pdf', 'voucher.pdf'),
      `inline; filename="voucher.pdf"; filename*=UTF-8''voucher.pdf`
    )
    assert.equal(
      contentDispositionFor('image/png', 'map.png'),
      `inline; filename="map.png"; filename*=UTF-8''map.png`
    )
    assert.equal(
      contentDispositionFor('text/plain', 'notes.txt'),
      `attachment; filename="notes.txt"; filename*=UTF-8''notes.txt`
    )
    assert.equal(
      contentDispositionFor(null, 'a"b\r\n'),
      `attachment; filename="a_b__"; filename*=UTF-8''a_b__`
    )
  })

  test('a non-ascii name keeps an ascii fallback and travels whole in filename*', ({ assert }) => {
    assert.equal(
      contentDispositionFor('application/pdf', "Café d'Orsay (1).pdf"),
      `inline; filename="Caf_ d'Orsay (1).pdf"; filename*=UTF-8''Caf%C3%A9%20d%27Orsay%20%281%29.pdf`
    )
  })

  test('a long name is cut by code point, never inside an emoji', ({ assert }) => {
    const header = contentDispositionFor('image/png', `${'a'.repeat(149)}🗺️.png`)

    // 149 letters and the map emoji make 150 code points; its variation selector is cut.
    assert.isTrue(header.endsWith(`filename*=UTF-8''${'a'.repeat(149)}%F0%9F%97%BA`))
  })

  test('bytes live under the trip and the document id', ({ assert }) => {
    assert.equal(documentStorageKey('trip-1', 'doc-1'), 'trips/trip-1/doc-1')
  })
})
