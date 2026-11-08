import { Worker } from 'node:worker_threads'
import { EXTRACTION_PDF_PARSE_MEMORY_MB, EXTRACTION_PDF_PARSE_TIMEOUT_MS } from '#config/extraction'

export interface PdfTextOptions {
  /** Pages read, from the first. */
  maxPages: number
  /** Characters kept, from the start. */
  maxChars: number
  /** Wall-clock limit of the parse; the worker is terminated past it. */
  timeoutMs?: number
  /** Heap of the parsing worker, in MB. */
  memoryMb?: number
}

export interface PdfText {
  /** Pages the file has, or null when it could not be parsed. */
  pages: number | null
  /** The text of the pages read, a blank line between pages. */
  text: string
  /** True when pages or characters were left out. */
  truncated: boolean
}

/**
 * The parse was stopped: it ran past its time limit, or the worker died
 * (out of memory, a crash inside pdf.js). The file is refused; the server
 * is unaffected. Carries no content of the file.
 */
export class PdfParseRefused extends Error {
  constructor(readonly reason: 'timeout' | 'failed') {
    super(`pdf parse refused: ${reason}`)
    this.name = 'PdfParseRefused'
  }
}

/**
 * The worker's code, plain JavaScript evaluated in a fresh thread: it
 * imports `unpdf` from the URL the main thread resolved (so it works the
 * same from sources and from the build), reads the text layer and posts
 * the result. pdf.js logs errors only (`verbosity: 0`); nothing of the
 * file is logged.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
;(async () => {
  const { getDocumentProxy } = await import(workerData.unpdfUrl)
  let document
  try {
    document = await getDocumentProxy(workerData.bytes, { verbosity: 0 })
  } catch {
    parentPort.postMessage({ pages: null, text: '', truncated: false })
    return
  }
  try {
    const pages = document.numPages
    const read = Math.min(pages, workerData.maxPages)
    const parts = []
    for (let number = 1; number <= read; number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      parts.push(
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\\n' : '') : ''))
          .join('')
          .trim()
      )
    }
    const text = parts.join('\\n\\n')
    const truncated = read < pages || text.length > workerData.maxChars
    parentPort.postMessage({ pages, text: text.slice(0, workerData.maxChars), truncated })
  } catch {
    parentPort.postMessage({ pages: document.numPages, text: '', truncated: false })
  }
})()
`

/**
 * The text layer of a PDF, read with pdf.js (through `unpdf`, pure
 * JavaScript, no native build): the first `maxPages` pages, cut to
 * `maxChars`. The parse runs in a `worker_thread` with a bounded heap and
 * a hard time limit, so a hostile file (a decompression bomb, a slow
 * structure) can neither block the API's event loop nor exhaust its
 * memory: past the limit the worker is terminated and `PdfParseRefused`
 * is thrown. A scanned PDF has an empty text layer; a file pdf.js cannot
 * parse reads as no text and an unknown page count.
 */
export async function readPdfText(bytes: Uint8Array, options: PdfTextOptions): Promise<PdfText> {
  // A copy the worker owns: transferring it leaves the caller's buffer intact.
  const copy = new Uint8Array(bytes)
  const worker = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: {
      bytes: copy,
      unpdfUrl: import.meta.resolve('unpdf'),
      maxPages: options.maxPages,
      maxChars: options.maxChars,
    },
    transferList: [copy.buffer],
    resourceLimits: {
      maxOldGenerationSizeMb: options.memoryMb ?? EXTRACTION_PDF_PARSE_MEMORY_MB,
      maxYoungGenerationSizeMb: 16,
    },
    stdout: true,
    stderr: true,
  })
  // The worker's own output is dropped: pdf.js must never write file content to the logs.
  worker.stdout.resume()
  worker.stderr.resume()

  return new Promise<PdfText>((resolve, reject) => {
    let settled = false
    const finish = (outcome: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      outcome()
      void worker.terminate().catch(() => undefined)
    }
    const timer = setTimeout(
      () => finish(() => reject(new PdfParseRefused('timeout'))),
      options.timeoutMs ?? EXTRACTION_PDF_PARSE_TIMEOUT_MS
    )
    worker.once('message', (result: PdfText) => finish(() => resolve(result)))
    worker.once('error', () => finish(() => reject(new PdfParseRefused('failed'))))
    worker.once('exit', () => finish(() => reject(new PdfParseRefused('failed'))))
  })
}
