/**
 * vitest-base.config.ts registers scripts/test/no-network.mjs as a setup
 * file, so no spec can reach the internet. These tests fail if the Angular
 * unit-test builder drops that setup file.
 */
describe('no-network guard', () => {
  it('blocks fetch to a host on the internet before any connection', async () => {
    const error: unknown = await fetch('https://example.com').then(
      () => null,
      (reason: unknown) => reason
    )

    expect(error).toBeInstanceOf(TypeError)
    const cause = (error as TypeError).cause
    expect(cause).toBeInstanceOf(Error)
    expect((cause as Error).message).toBe('no-network: blocked example.com')
  })

  it('is installed in the process that runs the specs', () => {
    const installed = (globalThis as Record<symbol, unknown>)[
      Symbol.for('monkitrips.no-network.installed')
    ]
    expect(installed).toBe(true)
  })
})
