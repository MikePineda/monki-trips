import { test } from '@japa/runner'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { ERROR_CODES, LOCALES } from '@monkitrips/shared'

/**
 * Every code the API can answer with has a message in every locale, so a
 * client never sees a raw `E_*` identifier. The parity test guarantees the
 * locales agree with each other; this one ties them to the shared table.
 */
test.group('Error code catalogs', () => {
  test('{$self} translates every shared error code')
    .with([...LOCALES])
    .run(async ({ assert }, locale) => {
      const catalog = JSON.parse(
        await readFile(join(app.languageFilesPath(), locale, 'errors.json'), 'utf8')
      )
      const missing = Object.keys(ERROR_CODES).filter((code) => !(code in catalog))
      assert.deepEqual(missing, [])
    })
})
