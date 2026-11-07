import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

/**
 * Layer and style rules:
 * - domain/ is pure TypeScript: no Angular, no RxJS, nothing outside domain/
 *   except the pure packages in DOMAIN_PACKAGES;
 * - only core/api/ talks to Tuyau (@tuyau/core and the API registry);
 * - colours are tokens: no hex literal anywhere but src/styles.css and the
 *   web manifest;
 * - fonts are self-hosted: no Google Fonts host anywhere.
 */
const webRoot = process.cwd()
const appRoot = join(webRoot, 'src/app')

const DOMAIN_PACKAGES = ['@monkitrips/shared']

/** Files that may hold raw colours. */
const HEX_ALLOWED = ['src/styles.css', 'public/manifest.webmanifest']

interface SourceFile {
  path: string
  rel: string
  imports: string[]
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const IMPORT =
  /(?:import|export)\s[^'"`]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

const sources: SourceFile[] = walk(appRoot)
  .filter((path) => path.endsWith('.ts') && !path.endsWith('.spec.ts'))
  .map((path) => {
    const text = readFileSync(path, 'utf8')
    const imports = [...text.matchAll(IMPORT)].map((match) => match[1] ?? match[2])
    return { path, rel: relative(appRoot, path).split(sep).join('/'), imports }
  })

/** For relative imports, the target path relative to src/app ('' for packages). */
function target(file: SourceFile, specifier: string): string {
  if (!specifier.startsWith('.')) {
    return ''
  }
  return relative(appRoot, resolve(dirname(file.path), specifier))
    .split(sep)
    .join('/')
}

function violations(predicate: (file: SourceFile, specifier: string) => boolean): string[] {
  return sources.flatMap((file) =>
    file.imports
      .filter((specifier) => predicate(file, specifier))
      .map((specifier) => `${file.rel} -> ${specifier}`)
  )
}

/** Every shipped web file outside build output: sources, index.html, public/. */
function webFiles(): string[] {
  return [...walk(join(webRoot, 'src')), ...walk(join(webRoot, 'public'))]
    .filter((path) => /\.(ts|html|css|scss|js|json|webmanifest|svg)$/.test(path))
    .filter((path) => !path.endsWith('.spec.ts'))
}

describe('architecture', () => {
  it('scans the app sources', () => {
    expect(sources.length).toBeGreaterThan(5)
    expect(sources.some((file) => file.rel.startsWith('domain/'))).toBe(true)
  })

  it('domain imports no Angular and no RxJS', () => {
    const bad = violations(
      (file, specifier) =>
        file.rel.startsWith('domain/') &&
        (specifier.startsWith('@angular/') || specifier.startsWith('rxjs'))
    )
    expect(bad).toEqual([])
  })

  it('domain imports nothing outside domain but pure packages', () => {
    const bad = violations((file, specifier) => {
      if (!file.rel.startsWith('domain/')) {
        return false
      }
      if (!specifier.startsWith('.')) {
        return !DOMAIN_PACKAGES.includes(specifier)
      }
      return !target(file, specifier).startsWith('domain/')
    })
    expect(bad).toEqual([])
  })

  it('only core/api talks to tuyau', () => {
    const bad = violations(
      (file, specifier) =>
        !file.rel.startsWith('core/api/') &&
        (specifier.startsWith('@tuyau/') || specifier.startsWith('@monkitrips/api'))
    )
    expect(bad).toEqual([])
  })

  it('no hex colour outside styles.css and the manifest', () => {
    const hex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/
    const offenders = webFiles()
      .map((path) => relative(webRoot, path).split(sep).join('/'))
      .filter((rel) => !HEX_ALLOWED.includes(rel))
      .filter((rel) => hex.test(readFileSync(join(webRoot, rel), 'utf8')))
    expect(offenders).toEqual([])
  })

  it('no google fonts host anywhere', () => {
    const offenders = webFiles()
      .filter((path) => /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(webRoot, path))
    expect(offenders).toEqual([])
  })
})
