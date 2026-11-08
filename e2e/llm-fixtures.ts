import { cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const API_FIXTURES = fileURLToPath(new URL('../apps/api/tests/fixtures/llm/', import.meta.url))
const E2E_FIXTURES = fileURLToPath(new URL('./fixtures/llm/', import.meta.url))
/** Where the fake provider of the built API looks (`app.makePath('tests/fixtures/llm')`). */
const BUILD_FIXTURES = fileURLToPath(
  new URL('../apps/api/build/tests/fixtures/llm/', import.meta.url)
)

/**
 * Puts the fake LLM's answers next to the built API the suite runs
 * (`LLM_PROVIDER=fake` in e2e.env). `node ace build` does not copy test
 * fixtures (and the production image must not ship them), so without this
 * every generation answers 503. The API's own fixtures go first, then the
 * suite's overrides (`e2e/fixtures/llm/<purpose>/<case>.json`: synthetic
 * Thai phrase cards for J16). Only the main process copies; workers load
 * the config again and find the files in place.
 *
 * It runs from playwright.config.ts because the `webServer` starts before
 * `globalSetup`; the fake reads a fixture on each call, so a copy made
 * before the first request is enough.
 */
export function stageLlmFixtures(env: NodeJS.ProcessEnv = process.env): void {
  if (env.TEST_WORKER_INDEX !== undefined) {
    return
  }
  if (existsSync(API_FIXTURES)) {
    cpSync(API_FIXTURES, BUILD_FIXTURES, { recursive: true })
  }
  cpSync(E2E_FIXTURES, BUILD_FIXTURES, { recursive: true })
}
