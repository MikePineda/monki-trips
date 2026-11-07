/**
 * What a file must look like before it leaves the device: 20 MB at most
 * (the API allows 25, the margin keeps a phone upload honest on a slow
 * link) and a PDF or an image. The browser's `type` is trusted when it
 * says something; otherwise the extension decides, the server sniffs the
 * bytes anyway. Pure.
 */

/** 20 MB, the client's limit for one document. */
export const CLIENT_MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

export type UploadRejection = 'too_large' | 'unsupported'

export type UploadCheck = { ok: true } | { ok: false; reason: UploadRejection }

export interface UploadCandidate {
  size: number
  /** The browser's MIME type, possibly empty. */
  type: string
  name: string
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'])

export function isSupportedDocumentType(type: string, name: string): boolean {
  if (type) {
    return type === 'application/pdf' || type.startsWith('image/')
  }
  const extension = name.toLowerCase().split('.').at(-1) ?? ''
  return extension === 'pdf' || IMAGE_EXTENSIONS.has(extension)
}

export function checkUploadFile(file: UploadCandidate): UploadCheck {
  if (file.size <= 0 || !isSupportedDocumentType(file.type, file.name)) {
    return { ok: false, reason: 'unsupported' }
  }
  if (file.size > CLIENT_MAX_DOCUMENT_BYTES) {
    return { ok: false, reason: 'too_large' }
  }
  return { ok: true }
}
