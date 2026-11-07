// SPDX-License-Identifier: AGPL-3.0-only
//
// Spec for scripts/test/no-network.mjs. Run: node --test scripts/test/no-network.test.mjs
// The guard is imported first, exactly as a test entry point does it.
import { isAllowedHost } from './no-network.mjs'

import assert from 'node:assert/strict'
import dns from 'node:dns'
import { lookup as promisesLookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import tls from 'node:tls'
import { after, before, describe, test } from 'node:test'

const BLOCKED = /no-network: blocked example\.com$/

/** The guard error, whether it was thrown directly or wrapped by fetch. */
function guardMessage(error) {
  return error?.cause?.message ?? error?.message
}

describe('no-network guard', () => {
  let server
  let port

  before(async () => {
    server = http.createServer((_req, res) => res.end('ok'))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = server.address().port
  })

  after(() => new Promise((resolve) => server.close(resolve)))

  test('fetch to an internet host rejects with the guard error', async () => {
    await assert.rejects(fetch('https://example.com'), (error) => {
      assert.match(guardMessage(error), BLOCKED)
      return true
    })
  })

  test('plain http to an internet host is blocked', () => {
    assert.throws(() => http.get('http://example.com/'), BLOCKED)
  })

  test('https through the default agent is blocked', () => {
    assert.throws(() => https.get('https://example.com/'), BLOCKED)
  })

  test('net.connect to an internet host is blocked', () => {
    assert.throws(() => net.connect(443, 'example.com'), BLOCKED)
    assert.throws(
      () => net.connect({ host: '93.184.215.14', port: 80 }),
      /no-network: blocked 93\.184\.215\.14/
    )
  })

  test('tls.connect to an internet host is blocked', () => {
    assert.throws(() => tls.connect({ host: 'example.com', port: 443 }), BLOCKED)
  })

  test('dns lookups of internet hosts are blocked', async () => {
    assert.throws(() => dns.lookup('example.com', () => {}), BLOCKED)
    await assert.rejects(dns.promises.lookup('example.com'), BLOCKED)
    await assert.rejects(promisesLookup('example.com'), BLOCKED)
  })

  test('a loopback TCP connection is allowed', async () => {
    await new Promise((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.end()
        resolve()
      })
      socket.on('error', reject)
    })
  })

  test('fetch to a loopback server is allowed (127.0.0.1 and localhost)', async () => {
    const byIp = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(await byIp.text(), 'ok')
    const byName = await fetch(`http://localhost:${port}/`).catch((error) => error)
    // `localhost` may resolve to ::1 first where the server only listens on
    // IPv4; what matters is that the guard did not block it.
    assert.doesNotMatch(String(guardMessage(byName) ?? ''), /no-network/)
  })

  test('a unix socket connection is allowed', async () => {
    if (process.platform === 'win32') return
    const dir = mkdtempSync(join(tmpdir(), 'no-network-'))
    const path = join(dir, 's.sock')
    const unix = net.createServer((socket) => socket.end())
    await new Promise((resolve) => unix.listen(path, resolve))
    try {
      await new Promise((resolve, reject) => {
        const socket = net.connect(path, resolve)
        socket.on('error', reject)
      })
    } finally {
      await new Promise((resolve) => unix.close(resolve))
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('loopback forms are recognised', () => {
    for (const host of [
      'localhost',
      'LOCALHOST.',
      '127.0.0.1',
      '127.1.2.3',
      '::1',
      '[::1]',
      '::ffff:127.0.0.1',
    ]) {
      assert.equal(isAllowedHost(host), true, host)
    }
    for (const host of ['example.com', '10.0.0.1', '128.0.0.1', '::2', 'localhost.example.com']) {
      assert.equal(isAllowedHost(host), false, host)
    }
  })

  test('NO_NETWORK_ALLOW_HOSTS allows exactly the listed hosts', () => {
    const previous = process.env.NO_NETWORK_ALLOW_HOSTS
    process.env.NO_NETWORK_ALLOW_HOSTS = 'db, minio.internal'
    try {
      assert.equal(isAllowedHost('db'), true)
      assert.equal(isAllowedHost('MINIO.internal'), true)
      assert.equal(isAllowedHost('db.example.com'), false)
      assert.throws(() => net.connect(80, 'example.com'), BLOCKED)
    } finally {
      if (previous === undefined) delete process.env.NO_NETWORK_ALLOW_HOSTS
      else process.env.NO_NETWORK_ALLOW_HOSTS = previous
    }
  })
})
