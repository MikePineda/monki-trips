import { test } from '@japa/runner'

/**
 * bin/test.ts loads scripts/test/no-network.mjs before anything else, so no
 * spec can reach the internet. These tests fail if that import goes away.
 */
test.group('No-network guard', () => {
  test('fetch to a host on the internet is blocked before any connection', async ({ assert }) => {
    const error: unknown = await fetch('https://example.com').then(
      () => null,
      (reason: unknown) => reason
    )

    assert.instanceOf(error, TypeError)
    const cause = (error as TypeError).cause
    assert.instanceOf(cause, Error)
    assert.equal((cause as Error).message, 'no-network: blocked example.com')
  })

  test('the guard is installed once for the whole process', ({ assert }) => {
    const installed = (globalThis as Record<symbol, unknown>)[
      Symbol.for('monkitrips.no-network.installed')
    ]
    assert.isTrue(installed)
  })
})
