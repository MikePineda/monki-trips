import { test } from '@japa/runner'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import { readdir, readFile } from 'node:fs/promises'
import { LOCALES } from '@monkitrips/shared'

/** [key, value] pairs of a nested catalog. */
function entries(value: unknown, prefix = ''): [string, unknown][] {
  if (typeof value !== 'object' || value === null) return [[prefix, value]]
  return Object.entries(value).flatMap(([key, child]) =>
    entries(child, prefix ? `${prefix}.${key}` : key)
  )
}

async function catalog(locale: string, file: string) {
  return JSON.parse(await readFile(join(app.languageFilesPath(), locale, file), 'utf8'))
}

test.group('Translation catalogs', () => {
  test('every locale has the same catalog files', async ({ assert }) => {
    const [reference, ...others] = await Promise.all(
      LOCALES.map(async (locale) => {
        const files = await readdir(join(app.languageFilesPath(), locale))
        return files.sort()
      })
    )
    for (const files of others) assert.deepEqual(files, reference)
    assert.include(reference, 'errors.json')
  })

  test('i18n catalogs have parity (every key exists in every locale)', async ({ assert }) => {
    const files = await readdir(join(app.languageFilesPath(), LOCALES[0]))
    for (const file of files) {
      const [reference, ...others] = await Promise.all(
        LOCALES.map(async (locale) =>
          entries(await catalog(locale, file))
            .map(([key]) => key)
            .sort()
        )
      )
      for (const keys of others) assert.deepEqual(keys, reference, file)
    }
  })

  test('no translation is empty', async ({ assert }) => {
    for (const locale of LOCALES) {
      for (const file of await readdir(join(app.languageFilesPath(), locale))) {
        for (const [key, value] of entries(await catalog(locale, file))) {
          assert.isString(value, `${locale}/${file}:${key}`)
          assert.isNotEmpty((value as string).trim(), `${locale}/${file}:${key}`)
        }
      }
    }
  })
})
