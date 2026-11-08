import { getDocumentProxy } from 'unpdf'

export interface PdfTextOptions {
  /** Pages read, from the first. */
  maxPages: number
  /** Characters kept, from the start. */
  maxChars: number
}

export interface PdfText {
  /** Pages the file has, or null when it could not be parsed. */
  pages: number | null
  /** The text of the pages read, a blank line between pages. */
  text: string
  /** True when pages or characters were left out. */
  truncated: boolean
}

/** pdf.js log level: errors only, so nothing of a file ever reaches the logs. */
const PDFJS_ERRORS_ONLY = 0

/**
 * The text layer of a PDF, read on the server with pdf.js (through `unpdf`,
 * pure JavaScript, no native build): the first `maxPages` pages, cut to
 * `maxChars`. A scanned PDF has an empty text layer; a file pdf.js cannot
 * parse reads as no text and an unknown page count. Nothing is logged.
 */
export async function readPdfText(bytes: Uint8Array, options: PdfTextOptions): Promise<PdfText> {
  let document: Awaited<ReturnType<typeof getDocumentProxy>>
  try {
    // pdf.js may detach the buffer it is given: hand it a copy.
    document = await getDocumentProxy(new Uint8Array(bytes), { verbosity: PDFJS_ERRORS_ONLY })
  } catch {
    return { pages: null, text: '', truncated: false }
  }
  try {
    const pages = document.numPages
    const read = Math.min(pages, options.maxPages)
    const parts: string[] = []
    for (let number = 1; number <= read; number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      parts.push(
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
          .join('')
          .trim()
      )
    }
    const text = parts.join('\n\n')
    const truncated = read < pages || text.length > options.maxChars
    return { pages, text: text.slice(0, options.maxChars), truncated }
  } catch {
    return { pages: document.numPages, text: '', truncated: false }
  } finally {
    await document.cleanup().catch(() => undefined)
  }
}
