import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guards the static PWA configuration: the manifest that makes the app
 * installable and the service-worker config that must never cache API data.
 */
const webRoot = process.cwd()
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(webRoot, path), 'utf8')) as T

interface Manifest {
  name: string
  id: string
  display: string
  orientation: string
  start_url: string
  theme_color: string
  background_color: string
  icons: { src: string; sizes: string; purpose?: string }[]
}

interface NgswConfig {
  navigationUrls: string[]
  assetGroups: { name: string; resources: { files: string[] } }[]
  dataGroups?: { urls: string[] }[]
}

describe('web app manifest', () => {
  const manifest = readJson<Manifest>('public/manifest.webmanifest')

  it('installs as monki trips, standalone and portrait, opening the trip list', () => {
    expect(manifest.name).toBe('monki trips')
    expect(manifest.id).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.orientation).toBe('portrait')
    expect(manifest.start_url).toBe('/trips')
  })

  it('manifest colours match the light page surface token', () => {
    const styles = readFileSync(join(webRoot, 'src/styles.css'), 'utf8')
    const surface0 = /--surface-0:\s*(#[0-9a-f]{6});/.exec(styles)?.[1]

    expect(surface0).toBeDefined()
    expect(manifest.theme_color).toBe(surface0)
    expect(manifest.background_color).toBe(surface0)
  })

  it('ships any and maskable icons that exist on disk', () => {
    const purposes = manifest.icons.map((icon) => icon.purpose ?? 'any')

    expect(purposes).toContain('any')
    expect(purposes).toContain('maskable')
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true)
    for (const icon of manifest.icons) {
      expect(existsSync(join(webRoot, 'public', icon.src)), icon.src).toBe(true)
    }
  })
})

describe('service worker config', () => {
  const config = readJson<NgswConfig>('ngsw-config.json')

  it('never caches api responses', () => {
    expect(config.dataGroups ?? []).toEqual([])
  })

  it('api urls are never served the app shell', () => {
    expect(config.navigationUrls).toContain('!/api/**')
  })

  it('prefetches the shell, the manifest and the translation catalogues', () => {
    const app = config.assetGroups.find((group) => group.name === 'app')

    expect(app?.resources.files).toEqual(
      expect.arrayContaining(['/index.html', '/manifest.webmanifest', '/i18n/*.json', '/*.js'])
    )
  })
})
