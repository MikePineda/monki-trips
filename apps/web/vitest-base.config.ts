import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Extra Vitest options for `ng test` (angular.json `runnerConfig`); the
 * Angular builder owns everything else.
 *
 * fsModuleCache is off: the builder serves each spec's bundle under the
 * spec's source path, and Vitest keys that file cache on the source file's
 * content, so an edit to anything a spec imports kept serving the old bundle.
 */
export default defineConfig({
  test: {
    fsModuleCache: false,
    // No test may reach the internet (scripts/test/no-network.mjs).
    setupFiles: [fileURLToPath(new URL('../../scripts/test/no-network.mjs', import.meta.url))],
  },
})
