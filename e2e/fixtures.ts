import { test as base, expect } from '@playwright/test'

/** Hosts the suite may talk to: the API under test serves everything. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

interface NetworkGuard {
  /** URLs of requests the guard aborted during the current test. */
  blockedRequests: string[]
}

/**
 * `test` for every spec: its browser context aborts any request to a host
 * other than 127.0.0.1/localhost (fonts CDNs, analytics, a forgotten real
 * API...) and records it; the afterEach hook then fails the test, so a
 * journey that only "works" because the internet answered never passes.
 */
export const test = base.extend<NetworkGuard>({
  // eslint-disable-next-line no-empty-pattern
  blockedRequests: async ({}, use) => {
    await use([])
  },
  context: async ({ context, blockedRequests }, use) => {
    await context.route('**/*', async (route) => {
      const url = route.request().url()
      const { protocol, hostname } = new URL(url)
      const local = !/^https?:$/.test(protocol) || LOCAL_HOSTS.has(hostname)
      if (local) {
        await route.continue()
        return
      }
      blockedRequests.push(url)
      await route.abort('blockedbyclient')
    })
    await use(context)
  },
})

test.afterEach(({ blockedRequests }) => {
  expect(blockedRequests, 'requests to non-local hosts were blocked').toEqual([])
})

export { expect }
