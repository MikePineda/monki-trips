import { test } from '@japa/runner'
import { uuidV5 } from '#domain/uuid_v5'

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

test.group('Name-based UUID (v5)', () => {
  test('matches the RFC vector for the DNS namespace', ({ assert }) => {
    assert.equal(uuidV5(DNS_NAMESPACE, 'www.example.com'), '2ed6657d-e927-568b-95e1-2665a8aea6a2')
  })

  test('the same namespace and name always give the same id, another name a different one', ({
    assert,
  }) => {
    const namespace = '0192f0a0-7c3e-7d1a-9b4a-3c2e1d0f9a8b'
    assert.equal(uuidV5(namespace, 'event:e1'), uuidV5(namespace, 'event:e1'))
    assert.notEqual(uuidV5(namespace, 'event:e1'), uuidV5(namespace, 'event:e2'))
    assert.notEqual(uuidV5(namespace, 'event:e1'), uuidV5(DNS_NAMESPACE, 'event:e1'))
  })

  test('refuses a namespace that is not a uuid', ({ assert }) => {
    assert.throws(() => uuidV5('import-1', 'x'), RangeError)
  })
})
