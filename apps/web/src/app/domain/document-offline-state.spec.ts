import { documentOfflineState } from './document-offline-state'

describe('documentOfflineState', () => {
  const file = { kind: 'file' as const, sha256: 'abc' }

  it('a link has no offline copy to speak of', () => {
    expect(documentOfflineState({ kind: 'link', sha256: null }, null, false)).toBe('link')
  })

  it('a file without a copy is not saved', () => {
    expect(documentOfflineState(file, null, false)).toBe('not_saved')
  })

  it('a file being fetched is saving, whatever the device already holds', () => {
    expect(documentOfflineState(file, null, true)).toBe('saving')
    expect(documentOfflineState(file, { sha256: 'abc' }, true)).toBe('saving')
  })

  it('a copy whose hash equals the server hash is saved', () => {
    expect(documentOfflineState(file, { sha256: 'abc' }, false)).toBe('saved')
  })

  it('a copy whose hash differs from the server hash is a mismatch', () => {
    expect(documentOfflineState(file, { sha256: 'zzz' }, false)).toBe('mismatch')
  })

  it('a copy of a file the server has no hash for cannot be verified', () => {
    expect(documentOfflineState({ kind: 'file', sha256: null }, { sha256: 'abc' }, false)).toBe(
      'mismatch'
    )
  })
})
