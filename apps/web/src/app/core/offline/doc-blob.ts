import type { DocBlobRecord } from './records'

/** A saved copy's file as a Blob of its type, whichever way the copy was stored. Pure. */
export function docBlob(copy: DocBlobRecord): Blob {
  if (copy.bytes) {
    return new Blob([copy.bytes], { type: copy.mime })
  }
  if (copy.blob?.type) {
    return copy.blob
  }
  return new Blob(copy.blob ? [copy.blob] : [], { type: copy.mime })
}
