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
      'inline; filename="voucher.pdf"'
    )
    assert.equal(contentDispositionFor('image/png', 'map.png'), 'inline; filename="map.png"')
    assert.equal(
      contentDispositionFor('text/plain', 'notes.txt'),
      'attachment; filename="notes.txt"'
    )
    assert.equal(contentDispositionFor(null, 'a"b\r\n'), 'attachment; filename="a_b__"')
  })

  test('bytes live under the trip and the document id', ({ assert }) => {
    assert.equal(documentStorageKey('trip-1', 'doc-1'), 'trips/trip-1/doc-1')
  })
})
