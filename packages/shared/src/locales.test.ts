import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_LOCALE, LOCALES } from './locales.ts'

test('english is the default locale and spanish is supported', () => {
  assert.equal(DEFAULT_LOCALE, 'en')
  assert.deepEqual([...LOCALES].sort(), ['en', 'es'])
})
