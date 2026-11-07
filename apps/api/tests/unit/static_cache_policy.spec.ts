import { test } from '@japa/runner'
import { cacheHeadersFor } from '#services/static_cache_policy'

const NO_CACHE = { 'Cache-Control': 'no-cache', 'CDN-Cache-Control': 'no-store' }
const IMMUTABLE = { 'Cache-Control': 'public, max-age=31536000, immutable' }

test.group('Static cache policy', () => {
  test('{$self} is never cached so a new deploy reaches installed PWAs')
    .with(['index.html', 'ngsw-worker.js', 'ngsw.json', 'sw.js', 'manifest.webmanifest'])
    .run(({ assert }, file) => {
      assert.deepEqual(cacheHeadersFor(file), NO_CACHE)
    })

  test('translation catalogs under /i18n are never cached', ({ assert }) => {
    assert.deepEqual(cacheHeadersFor('i18n/es.json'), NO_CACHE)
    assert.deepEqual(cacheHeadersFor('/i18n/en.json'), NO_CACHE)
  })

  test('{$self} carries a content hash and is cached forever')
    .with([
      'main-HFSQMWGS.js',
      'chunk-7UQ2KXRB.js',
      'chunk-D436evU6.js',
      'styles-5INURTSO.css',
      'media/font-ZK3A2D4Q.woff2',
    ])
    .run(({ assert }, file) => {
      assert.deepEqual(cacheHeadersFor(file), IMMUTABLE)
    })

  test('{$self} has no hash and gets a short public cache')
    .with(['favicon.ico', 'icons/icon-192.png', 'theme-boot.js', 'icons/icon-maskable.png'])
    .run(({ assert }, file) => {
      assert.deepEqual(cacheHeadersFor(file), { 'Cache-Control': 'public, max-age=3600' })
    })

  test('windows-style separators are normalised', ({ assert }) => {
    assert.deepEqual(cacheHeadersFor('i18n\\es.json'), NO_CACHE)
  })
})
