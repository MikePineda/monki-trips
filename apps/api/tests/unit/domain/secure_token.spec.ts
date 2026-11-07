import { test } from '@japa/runner'
import {
  generateSecureToken,
  generateVerificationCode,
  hashCode,
  hashToken,
} from '#domain/secure_token'

test.group('Secure tokens', () => {
  test('tokens are url-safe, long and never repeat', ({ assert }) => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSecureToken()))
    assert.lengthOf(tokens, 50)
    for (const token of tokens) {
      assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    }
  })

  test('hashing a token is deterministic and never contains the plaintext', ({ assert }) => {
    const token = generateSecureToken()
    assert.equal(hashToken(token), hashToken(token))
    assert.match(hashToken(token), /^[0-9a-f]{64}$/)
    assert.notInclude(hashToken(token), token.slice(0, 8))
    assert.notEqual(hashToken(token), hashToken(`${token}x`))
  })

  test('verification codes are six digits, zero padded', ({ assert }) => {
    for (let i = 0; i < 200; i++) {
      assert.match(generateVerificationCode(), /^\d{6}$/)
    }
  })

  test('the same code hashes differently under two tokens', ({ assert }) => {
    assert.notEqual(hashCode('123456', 'token-a'), hashCode('123456', 'token-b'))
    assert.equal(hashCode('123456', 'token-a'), hashCode('123456', 'token-a'))
  })
})
