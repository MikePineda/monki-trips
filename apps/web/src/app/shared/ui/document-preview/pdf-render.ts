import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import type { RenderedPdf } from './pdf-renderer'

/** One module worker for every PDF, bundled with the app (see pdf.worker.ts). */
GlobalWorkerOptions.workerPort ??= new Worker(new URL('./pdf.worker', import.meta.url), {
  type: 'module',
})

/**
 * pdf.js rendering, loaded only through `PDF_RENDERER` (a lazy chunk):
 * each page becomes a canvas at the device's pixel ratio, scaled to the
 * host's width.
 */
export async function renderPdf(
  data: ArrayBuffer,
  host: HTMLElement,
  width: number
): Promise<RenderedPdf> {
  const task = getDocument({ data: new Uint8Array(data) })
  const pdf = await task.promise
  const ratio = globalThis.devicePixelRatio || 1
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: (width / base.width) * ratio })
    const canvas = host.ownerDocument.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.className = 'mk-document-preview__page'
    canvas.setAttribute('data-testid', 'ui.preview.page')
    host.appendChild(canvas)
    await page.render({ canvas, viewport }).promise
  }
  return {
    pages: pdf.numPages,
    destroy: () => {
      void task.destroy()
    },
  }
}
