import { test } from 'node:test'
import assert from 'node:assert/strict'
import { offlineReadiness, type OfflineReadinessInput } from './offline_readiness.ts'

const ready: OfflineReadinessInput = {
  now: '2026-01-13T12:00:00Z',
  app: { cachedVersion: '1.4.0', updatePending: false },
  snapshotAt: '2026-01-13T09:00:00Z',
  documents: [
    { id: 'doc-a', serverSha256: 'aaa', cachedSha256: 'aaa' },
    { id: 'doc-b', serverSha256: 'bbb', cachedSha256: 'bbb' },
  ],
  assets: { locales: true, mascot: true },
  storage: { persisted: true, usageBytes: 40_000_000, quotaBytes: 200_000_000 },
  outboxCount: 0,
  platform: 'android',
  installed: false,
}

function check(input: OfflineReadinessInput, key: string) {
  return offlineReadiness(input).checks.find((c) => c.key === key)!
}

test('all seven checks green means ready to fly', () => {
  const result = offlineReadiness(ready)
  assert.equal(result.ready, true)
  assert.deepEqual(
    result.checks.map((c) => c.key),
    ['version', 'snapshot', 'documents', 'assets', 'storage', 'outbox', 'installed']
  )
  assert.equal(
    result.checks.every((c) => c.ok),
    true
  )
})

test('not ready when a doc hash mismatches', () => {
  const result = offlineReadiness({
    ...ready,
    documents: [
      { id: 'doc-a', serverSha256: 'aaa', cachedSha256: 'aaa' },
      { id: 'doc-b', serverSha256: 'bbb-v2', cachedSha256: 'bbb' },
      { id: 'doc-c', serverSha256: 'ccc', cachedSha256: null },
    ],
  })
  assert.equal(result.ready, false)
  const documents = result.checks.find((c) => c.key === 'documents')!
  assert.equal(documents.ok, false)
  assert.deepEqual(documents.documentIds, ['doc-b', 'doc-c'])
})

test('a snapshot older than twenty-four hours is stale, a missing one too', () => {
  const stale = check({ ...ready, snapshotAt: '2026-01-12T11:59:00Z' }, 'snapshot')
  assert.equal(stale.ok, false)
  assert.equal(stale.ageMs, 24 * 3_600_000 + 60_000)
  assert.equal(check({ ...ready, snapshotAt: '2026-01-12T12:00:01Z' }, 'snapshot').ok, true)
  const missing = check({ ...ready, snapshotAt: null }, 'snapshot')
  assert.equal(missing.ok, false)
  assert.equal('ageMs' in missing, false)
})

test('a non-empty outbox is not ready', () => {
  const outbox = check({ ...ready, outboxCount: 3 }, 'outbox')
  assert.equal(outbox.ok, false)
  assert.equal(outbox.count, 3)
  assert.equal(offlineReadiness({ ...ready, outboxCount: 3 }).ready, false)
})

test('storage must be persisted with free space at least twice the usage', () => {
  assert.equal(
    check({ ...ready, storage: { ...ready.storage, persisted: false } }, 'storage').ok,
    false
  )
  assert.equal(
    check({ ...ready, storage: { persisted: true, usageBytes: 100, quotaBytes: 299 } }, 'storage')
      .ok,
    false
  )
  assert.equal(
    check({ ...ready, storage: { persisted: true, usageBytes: 100, quotaBytes: 300 } }, 'storage')
      .ok,
    true
  )
})

test('on iOS the app must be installed; elsewhere the check does not apply', () => {
  const safari = check({ ...ready, platform: 'ios', installed: false }, 'installed')
  assert.equal(safari.ok, false)
  assert.equal(safari.notApplicable, undefined)
  assert.equal(check({ ...ready, platform: 'ios', installed: true }, 'installed').ok, true)
  const android = check(ready, 'installed')
  assert.equal(android.ok, true)
  assert.equal(android.notApplicable, true)
})

test('a pending update or no cached version fails the version check', () => {
  assert.equal(
    check({ ...ready, app: { cachedVersion: '1.4.0', updatePending: true } }, 'version').ok,
    false
  )
  assert.equal(
    check({ ...ready, app: { cachedVersion: null, updatePending: false } }, 'version').ok,
    false
  )
})

test('both languages and the mascot must be cached', () => {
  assert.equal(check({ ...ready, assets: { locales: false, mascot: true } }, 'assets').ok, false)
  assert.equal(check({ ...ready, assets: { locales: true, mascot: false } }, 'assets').ok, false)
})
