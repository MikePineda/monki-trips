import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { APP_LANGS } from '../../domain/locale'

/**
 * Every catalogue directory (the global one in public/i18n and one per
 * feature scope under src/app/** /i18n) must hold one file per language with
 * exactly the same keys, no empty values, and the same ICU arguments.
 */
const webRoot = process.cwd()

type Catalog = Record<string, unknown>

function catalogDirs(): string[] {
  const dirs = [join(webRoot, 'public/i18n')]
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (!statSync(path).isDirectory()) {
        continue
      }
      const holdsCatalogues = readdirSync(path).some((file) => file.endsWith('.json'))
      if (entry === 'i18n' && holdsCatalogues) {
        dirs.push(path)
      } else {
        walk(path)
      }
    }
  }
  walk(join(webRoot, 'src/app'))
  return dirs
}

function flatten(catalog: Catalog, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object') {
      for (const [nested, text] of flatten(value as Catalog, path)) {
        result.set(nested, text)
      }
    } else {
      result.set(path, String(value))
    }
  }
  return result
}

/** ICU argument names ({name}, {count, plural, ...}), ignoring branch bodies. */
function icuArguments(text: string): string[] {
  return [...text.matchAll(/\{\s*([A-Za-z_][\w]*)\s*[,}]/g)].map((match) => match[1]).sort()
}

const dirs = catalogDirs()

describe('i18n catalogues', () => {
  it('finds the global and the scope catalogues', () => {
    expect(dirs.length).toBeGreaterThan(1)
  })

  for (const dir of dirs) {
    const name = relative(webRoot, dir)

    describe(name, () => {
      const catalogs = new Map(
        APP_LANGS.map((lang) => {
          const file = join(dir, `${lang}.json`)
          return [lang, flatten(JSON.parse(readFileSync(file, 'utf8')) as Catalog)] as const
        })
      )
      const [reference, ...others] = APP_LANGS
      const referenceKeys = [...(catalogs.get(reference)?.keys() ?? [])].sort()

      it('has one file per language and no extra languages', () => {
        const files = readdirSync(dir)
          .filter((file) => file.endsWith('.json'))
          .map((file) => file.replace(/\.json$/, ''))
          .sort()
        expect(files).toEqual([...APP_LANGS].sort())
      })

      for (const lang of others) {
        it(`${lang} has exactly the keys of ${reference}`, () => {
          const keys = [...(catalogs.get(lang)?.keys() ?? [])].sort()
          const missing = referenceKeys.filter((key) => !keys.includes(key))
          const extra = keys.filter((key) => !referenceKeys.includes(key))

          expect({ missing, extra }).toEqual({ missing: [], extra: [] })
        })

        it(`${lang} uses the same ICU arguments as ${reference}`, () => {
          const mismatched = referenceKeys.filter((key) => {
            const a = icuArguments(catalogs.get(reference)?.get(key) ?? '')
            const b = icuArguments(catalogs.get(lang)?.get(key) ?? '')
            return a.join(',') !== b.join(',')
          })
          expect(mismatched).toEqual([])
        })
      }

      it('no value is empty', () => {
        const empty = APP_LANGS.flatMap((lang) =>
          [...(catalogs.get(lang)?.entries() ?? [])]
            .filter(([, text]) => text.trim() === '')
            .map(([key]) => `${lang}:${key}`)
        )
        expect(empty).toEqual([])
      })
    })
  }
})
