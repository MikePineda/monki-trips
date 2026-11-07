import { InjectionToken } from '@angular/core'

/** A rendered PDF: how many pages it has, and how to free its memory. */
export interface RenderedPdf {
  pages: number
  destroy(): void
}

/**
 * Draws every page of a PDF into `host` (one canvas per page, `width` CSS
 * pixels wide). The default loads pdf.js on first use, in its own lazy
 * chunk (with its module worker, both hashed chunks prefetched by the
 * service worker so a quick view works offline); specs swap it.
 */
export type PdfRenderer = (
  data: ArrayBuffer,
  host: HTMLElement,
  width: number
) => Promise<RenderedPdf>

export const PDF_RENDERER = new InjectionToken<PdfRenderer>('PDF_RENDERER', {
  providedIn: 'root',
  factory: () => async (data, host, width) => {
    const { renderPdf } = await import('./pdf-render')
    return renderPdf(data, host, width)
  },
})
