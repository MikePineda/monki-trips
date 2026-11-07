/**
 * Hands a document's bytes to the person: the system share sheet when the
 * browser can share files (`navigator.share({ files })` after `canShare`),
 * else a download through a temporary `<a download>`. The object URL is
 * revoked right after the click.
 */
export interface ShareTarget {
  navigator: Pick<Navigator, 'share' | 'canShare'> | null
  document: Document
  url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>
}

export type HandOver = 'shared' | 'downloaded' | 'cancelled'

export function fileOf(blob: Blob, title: string): File {
  const extension =
    blob.type === 'application/pdf'
      ? '.pdf'
      : blob.type.startsWith('image/')
        ? `.${blob.type.slice(6)}`
        : ''
  const name = /\.[a-z0-9]+$/i.test(title) ? title : `${title}${extension}`
  return new File([blob], name, { type: blob.type })
}

export function download(target: ShareTarget, file: File): HandOver {
  const href = target.url.createObjectURL(file)
  const anchor = target.document.createElement('a')
  anchor.href = href
  anchor.download = file.name
  anchor.rel = 'noopener'
  target.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => target.url.revokeObjectURL(href), 0)
  return 'downloaded'
}

export async function shareOrDownload(
  target: ShareTarget,
  file: File,
  title: string
): Promise<HandOver> {
  const nav = target.navigator
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      throw error
    }
  }
  return download(target, file)
}
