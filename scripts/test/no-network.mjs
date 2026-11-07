// SPDX-License-Identifier: AGPL-3.0-only
//
// Network guard for test runs: no test may reach the internet.
//
// Import it before anything else in a test entry point (Japa `bin/test.ts`,
// `node --import`, or a Vitest `setupFiles` entry). It patches the Node
// layers every client goes through, including the fetch built into Node
// (undici), `http`/`https`, `pg` and the AWS SDK:
//
//   net.Socket.prototype.connect   every TCP connection (TLS sockets inherit it)
//   tls.connect                    fails early with the host name
//   dns.lookup, dns.promises.lookup
//                                  name resolution done by hand
//
// Allowed: loopback (127.0.0.0/8, ::1, ::ffff:127.x, `localhost`), unix
// sockets and named pipes, and the hosts in NO_NETWORK_ALLOW_HOSTS
// (comma-separated, exact names or IPs, for example the database container
// of scripts/test-offline.sh). Anything else throws
// `Error('no-network: blocked <host>')`; fetch rejects with
// `TypeError('fetch failed')` whose `cause` is that error.
//
// Not covered: UDP (`dgram`) and child processes. scripts/test-offline.sh is
// the strong check: there the kernel has no route out at all.

import dns from 'node:dns'
import { syncBuiltinESMExports } from 'node:module'
import net from 'node:net'
import tls from 'node:tls'

const INSTALLED = Symbol.for('monkitrips.no-network.installed')

/** Hosts from NO_NETWORK_ALLOW_HOSTS, lowercased, brackets and trailing dots removed. */
function extraHosts() {
  return (process.env.NO_NETWORK_ALLOW_HOSTS ?? '')
    .split(',')
    .map((host) => normalizeHost(host))
    .filter(Boolean)
}

function normalizeHost(host) {
  return String(host ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '')
}

/** True when a connection to `host` stays on this machine or is explicitly allowed. */
export function isAllowedHost(host) {
  const name = normalizeHost(host)
  if (name === '' || name === 'localhost' || name.endsWith('.localhost')) return true
  if (name === '::1' || name === '0:0:0:0:0:0:0:1') return true
  const v4 = name.startsWith('::ffff:') ? name.slice('::ffff:'.length) : name
  if (net.isIPv4(v4) && v4.split('.')[0] === '127') return true
  return extraHosts().includes(name)
}

function blocked(host) {
  return new Error(`no-network: blocked ${normalizeHost(host) || String(host)}`)
}

/**
 * Extracts the target of a `socket.connect(...)` call. Returns `null` for
 * unix sockets and named pipes, otherwise the host (`localhost` when omitted,
 * as Node defaults it).
 */
function connectTarget(args) {
  // net.connect() and tls hand over an already normalized [options, cb] array.
  const first = Array.isArray(args[0]) ? args[0][0] : args[0]
  if (first !== null && typeof first === 'object') {
    if (first.path !== undefined && first.path !== null) return null
    return first.host ?? first.hostname ?? 'localhost'
  }
  if (typeof first === 'string' && !/^\d+$/.test(first)) return null // a path
  return typeof args[1] === 'string' ? args[1] : 'localhost'
}

function install() {
  if (globalThis[INSTALLED]) return
  globalThis[INSTALLED] = true

  const originalConnect = net.Socket.prototype.connect
  net.Socket.prototype.connect = function guardedConnect(...args) {
    const host = connectTarget(args)
    if (host !== null && !isAllowedHost(host)) throw blocked(host)
    return originalConnect.apply(this, args)
  }

  const originalTlsConnect = tls.connect
  tls.connect = function guardedTlsConnect(...args) {
    const options = args.find((arg) => arg !== null && typeof arg === 'object') ?? {}
    // Wrapping an existing socket: that socket already went through the guard.
    // Options objects may have a null prototype (http agents), so never
    // coerce them to a string.
    if (!options.socket) {
      const portFirst =
        typeof args[0] === 'number' || (typeof args[0] === 'string' && /^\d+$/.test(args[0]))
      const host = portFirst
        ? typeof args[1] === 'string'
          ? args[1]
          : (options.host ?? 'localhost')
        : (options.host ?? options.servername ?? 'localhost')
      if (!options.path && !isAllowedHost(host)) throw blocked(host)
    }
    return originalTlsConnect.apply(this, args)
  }

  const originalLookup = dns.lookup
  dns.lookup = function guardedLookup(hostname, ...rest) {
    if (!isAllowedHost(hostname)) throw blocked(hostname)
    return originalLookup.call(this, hostname, ...rest)
  }

  const originalPromisesLookup = dns.promises.lookup
  dns.promises.lookup = function guardedPromisesLookup(hostname, ...rest) {
    if (!isAllowedHost(hostname)) return Promise.reject(blocked(hostname))
    return originalPromisesLookup.call(this, hostname, ...rest)
  }

  // Keep `import { connect } from 'node:tls'` style named imports in sync.
  syncBuiltinESMExports()
}

install()
