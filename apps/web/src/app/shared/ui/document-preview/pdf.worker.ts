/**
 * The pdf.js worker, bundled by the Angular builder as a module worker
 * (`new Worker(new URL('./pdf.worker', import.meta.url))` in pdf-render.ts):
 * a hashed chunk the service worker prefetches like every other script, so
 * a quick view works offline and nothing comes from a CDN.
 */
import 'pdfjs-dist/build/pdf.worker.min.mjs'
