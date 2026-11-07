import { test } from '@japa/runner'
import { userTokenExpiry, userTokenState } from '#domain/user_token_rules'

const now = new Date('2026-11-07T10:00:00Z')
const minutes = (count: number) => new Date(now.getTime() + count * 60_000)

test.group('User token rules', () => {
  test('verification tokens live fifteen minutes and reset tokens sixty', ({ assert }) => {
    assert.deepEqual(userTokenExpiry('verify_email', now), minutes(15))
    assert.deepEqual(userTokenExpiry('reset_password', now), minutes(60))
  })

  test('a fresh token is valid until its expiry instant', ({ assert }) => {
    const token = {
      purpose: 'verify_email' as const,
      expiresAt: minutes(15),
      usedAt: null,
      attempts: 0,
    }
    assert.equal(userTokenState(token, now), 'valid')
    assert.equal(userTokenState(token, minutes(14)), 'valid')
    assert.equal(userTokenState(token, minutes(15)), 'expired')
  })

  test('a used token stays used even before it expires', ({ assert }) => {
    const token = {
      purpose: 'reset_password' as const,
      expiresAt: minutes(60),
      usedAt: now,
      attempts: 0,
    }
    assert.equal(userTokenState(token, minutes(1)), 'used')
  })

  test('five wrong codes exhaust a verification token', ({ assert }) => {
    const base = { purpose: 'verify_email' as const, expiresAt: minutes(15), usedAt: null }
    assert.equal(userTokenState({ ...base, attempts: 4 }, now), 'valid')
    assert.equal(userTokenState({ ...base, attempts: 5 }, now), 'exhausted')
  })
})
