/**
 * Cache-Control policy for the files the API serves from `public/` (the
 * Angular build in production).
 *
 * The PWA trap this guards against: if a browser or a CDN caches the service
 * worker, its manifest or index.html, installed apps stay pinned to an old
 * build. Those files always revalidate; content-hashed bundles are cached
 * forever.
 */

const NO_CACHE = { 'Cache-Control': 'no-cache', 'CDN-Cache-Control': 'no-store' }
const IMMUTABLE = { 'Cache-Control': 'public, max-age=31536000, immutable' }
const SHORT_LIVED = { 'Cache-Control': 'public, max-age=3600' }

/** Files that decide which build a client runs. */
const ALWAYS_REVALIDATE = new Set([
  'index.html',
  'ngsw-worker.js',
  'ngsw.json',
  'sw.js',
  'manifest.webmanifest',
  'safety-worker.js',
  'worker-basic.min.js',
])

/**
 * Angular's output hashing: `name-XXXXXXXX.ext`. Initial files use an
 * uppercase hash (`main-SKJHZDS5.js`), lazy chunks a mixed-case one
 * (`chunk-D436evU6.js`). At least one uppercase letter or digit is required
 * so a plain word (`icon-maskable.png`) is never taken for a hash.
 */
const CONTENT_HASH = /-(?=[A-Za-z0-9]*[A-Z0-9])[A-Za-z0-9]{8,}\.[a-z0-9]+$/

/**
 * Returns the caching headers for a file, given its path relative to the
 * public directory.
 */
export function cacheHeadersFor(relativePath: string): Record<string, string> {
  const path = relativePath.replaceAll('\\', '/').replace(/^\/+/, '')
  const fileName = path.split('/').at(-1) ?? path

  if (ALWAYS_REVALIDATE.has(fileName) || path.startsWith('i18n/')) {
    return { ...NO_CACHE }
  }
  if (CONTENT_HASH.test(fileName)) {
    return { ...IMMUTABLE }
  }
  return { ...SHORT_LIVED }
}
