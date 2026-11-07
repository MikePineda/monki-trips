import { test } from '@japa/runner'
import { resolveClientIp } from '#domain/client_address'

test.group('Client address', () => {
  test('without a trusted proxy the socket address wins over any header', ({ assert }) => {
    assert.equal(
      resolveClientIp({
        trustedProxy: 'none',
        socketIp: '127.0.0.1',
        cfConnectingIp: '203.0.113.9',
      }),
      '127.0.0.1'
    )
  })

  test('behind cloudflare the cf-connecting-ip header names the client', ({ assert }) => {
    assert.equal(
      resolveClientIp({
        trustedProxy: 'cloudflare',
        socketIp: '127.0.0.1',
        cfConnectingIp: ' 203.0.113.9 ',
      }),
      '203.0.113.9'
    )
  })

  test('behind cloudflare a missing or blank header falls back to the socket', ({ assert }) => {
    assert.equal(resolveClientIp({ trustedProxy: 'cloudflare', socketIp: '10.0.0.2' }), '10.0.0.2')
    assert.equal(
      resolveClientIp({ trustedProxy: 'cloudflare', socketIp: '10.0.0.2', cfConnectingIp: '  ' }),
      '10.0.0.2'
    )
  })
})
