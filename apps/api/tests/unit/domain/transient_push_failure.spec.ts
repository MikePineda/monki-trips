import { test } from '@japa/runner'
import { isTransientPushFailure } from '#domain/transient_push_failure'

test.group('Transient push failure', () => {
  test('server errors, rate limits, timeouts and network errors are worth a retry', ({
    assert,
  }) => {
    assert.isTrue(isTransientPushFailure({ status: 'failed', statusCode: 500 }))
    assert.isTrue(isTransientPushFailure({ status: 'failed', statusCode: 503 }))
    assert.isTrue(isTransientPushFailure({ status: 'failed', statusCode: 429 }))
    assert.isTrue(isTransientPushFailure({ status: 'failed', statusCode: null }))
  })

  test('a delivery, a gone endpoint and a rejected request are not', ({ assert }) => {
    assert.isFalse(isTransientPushFailure({ status: 'sent' }))
    assert.isFalse(isTransientPushFailure({ status: 'gone', statusCode: 410 }))
    assert.isFalse(isTransientPushFailure({ status: 'gone', statusCode: 404 }))
    assert.isFalse(isTransientPushFailure({ status: 'failed', statusCode: 400 }))
    assert.isFalse(isTransientPushFailure({ status: 'failed', statusCode: 403 }))
    assert.isFalse(isTransientPushFailure({ status: 'failed', statusCode: 413 }))
  })
})
