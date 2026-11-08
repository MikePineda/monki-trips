import { docBlob } from './doc-blob'
import type { DocBlobRecord } from './records'

const copy = (overrides: Partial<DocBlobRecord>): DocBlobRecord => ({
  docId: 'doc-1',
  sha256: 'a'.repeat(64),
  size: 3,
  mime: 'application/pdf',
  savedAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
})

describe('docBlob', () => {
  it('builds the file from the stored bytes with the copy type', async () => {
    const blob = docBlob(copy({ bytes: new TextEncoder().encode('pdf').buffer }))

    expect(blob.type).toBe('application/pdf')
    expect(await blob.text()).toBe('pdf')
  })

  it('returns the blob of a copy saved by an earlier version as it is', () => {
    const legacy = new Blob(['pdf'], { type: 'application/pdf' })

    expect(docBlob(copy({ blob: legacy }))).toBe(legacy)
  })

  it('gives an earlier copy whose blob lost its type the type of the copy', async () => {
    const blob = docBlob(copy({ blob: new Blob(['pdf']) }))

    expect(blob.type).toBe('application/pdf')
    expect(await blob.text()).toBe('pdf')
  })
})
