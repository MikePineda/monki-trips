import { test } from '@japa/runner'
import { isUniqueViolation, uniqueViolationCode } from '#exceptions/unique_violation'

test.group('Unique violation', () => {
  const duplicate = (constraint: string) => ({ code: '23505', constraint })

  test('recognises a Postgres duplicate key, optionally on one constraint', ({ assert }) => {
    assert.isTrue(isUniqueViolation(duplicate('trips_pkey')))
    assert.isTrue(isUniqueViolation(duplicate('trips_pkey'), 'trips_pkey'))
    assert.isFalse(isUniqueViolation(duplicate('users_email_unique'), 'trips_pkey'))
    assert.isFalse(isUniqueViolation({ code: '23503' }))
    assert.isFalse(isUniqueViolation(new Error('boom')))
    assert.isFalse(isUniqueViolation(null))
  })

  test('a taken e-mail answers E_EMAIL_TAKEN and any other duplicate E_CONFLICT', ({ assert }) => {
    assert.equal(uniqueViolationCode(duplicate('users_email_unique')), 'E_EMAIL_TAKEN')
    assert.equal(uniqueViolationCode(duplicate('trip_members_one_owner')), 'E_CONFLICT')
  })
})
