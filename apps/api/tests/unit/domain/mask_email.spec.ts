import { test } from '@japa/runner'
import { maskEmail } from '#domain/mask_email'

test.group('Mask e-mail', () => {
  test('keeps the first character of the local part and the domain', ({ assert }) => {
    assert.equal(maskEmail('member@example.com'), 'm***@example.com')
    assert.equal(maskEmail('a@example.com'), 'a***@example.com')
  })

  test('something that is not an address is masked whole', ({ assert }) => {
    assert.equal(maskEmail('no-at-sign'), '***')
    assert.equal(maskEmail('@example.com'), '***@example.com')
  })
})
