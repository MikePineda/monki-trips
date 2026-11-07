import { test } from '@japa/runner'
import { normalizeEmail } from '#domain/normalize_email'

test.group('Normalize e-mail', () => {
  test('trims and lowercases the address', ({ assert }) => {
    assert.equal(normalizeEmail('  Owner@Example.COM '), 'owner@example.com')
  })
})
