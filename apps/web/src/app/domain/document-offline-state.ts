/**
 * What the list says about a document's offline copy: a link needs none;
 * a file is `not_saved`, `saving` while its bytes are on their way,
 * `saved` once the device holds a copy whose sha256 equals the server's,
 * or `mismatch` when the copy's hash differs (a re-uploaded file, a
 * corrupted write). Pure.
 */
export type DocumentOfflineState = 'link' | 'not_saved' | 'saving' | 'saved' | 'mismatch'

export interface OfflineStateDocument {
  kind: 'file' | 'link'
  sha256: string | null
}

export function documentOfflineState(
  document: OfflineStateDocument,
  copy: { sha256: string } | null,
  saving: boolean
): DocumentOfflineState {
  if (document.kind === 'link') {
    return 'link'
  }
  if (saving) {
    return 'saving'
  }
  if (!copy) {
    return 'not_saved'
  }
  return document.sha256 !== null && copy.sha256 === document.sha256 ? 'saved' : 'mismatch'
}
