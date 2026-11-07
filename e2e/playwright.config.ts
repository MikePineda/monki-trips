import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { ensureVapidKeys } from './vapid-keys.ts'

/**
 * E2E suite against the real stack: the production build of the API
 * (apps/api/build) serving the production build of the Angular app, backed
 * by the ephemeral compose.test.yaml Postgres. Run it with `npm run e2e`
 * (builds, starts the stack, migrates, runs, tears down).
 *
 * scripts/e2e.sh picks the run's E2E slot and exports what depends on it:
 * the API port (PORT) and the result and report folders.
 */
process.loadEnvFile(fileURLToPath(new URL('./e2e.env', import.meta.url)))
// A VAPID pair for this run only, handed to the API through the environment.
ensureVapidKeys()

if (!process.env.PORT) {
  throw new Error(
    'PORT is not set: run the suite through scripts/e2e.sh (`npm run e2e`), which starts the stack for an E2E slot and exports its ports.'
  )
}
const baseURL = `http://127.0.0.1:${process.env.PORT}`

/** E2E_WORKERS as Playwright takes it: a count, or a share like "50%". */
function workersFromEnv(value: string | undefined): number | string | undefined {
  if (!value) {
    return undefined
  }
  return value.endsWith('%') ? value : Number(value)
}

/**
 * A Chrome already on the machine (cloud sessions cannot download
 * Playwright's browsers). One variable only: CHROME_PATH.
 */
const chromePath = process.env.CHROME_PATH

/**
 * On macOS, Playwright's Chromium headless shell reports
 * `Notification.permission === 'denied'` even after `grantPermissions`
 * (J14 then sees notifications as blocked); the new headless mode of the
 * full Chromium build reports `granted`. Linux (CI) keeps the shell.
 */
const chromiumLaunch = chromePath
  ? { launchOptions: { executablePath: chromePath } }
  : process.platform === 'darwin'
    ? { channel: 'chromium' }
    : {}

export default defineConfig({
  testDir: './tests',
  // Creates the suite's accounts on the run's database (e2e/accounts.ts).
  globalSetup: './global-setup.ts',
  outputDir: process.env.E2E_RESULTS_DIR,
  workers: workersFromEnv(process.env.E2E_WORKERS),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: process.env.E2E_REPORT_DIR }]]
    : [['list']],
  use: {
    baseURL,
    // The app's first language follows the device (navigator.languages): pin it.
    locale: 'en-AU',
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        ...chromiumLaunch,
      },
    },
    // WebKit needs Playwright's own build: CI and machines that have it opt in.
    ...(process.env.E2E_WEBKIT === '1'
      ? [{ name: 'mobile-webkit', use: { ...devices['iPhone 14'] } }]
      : []),
  ],
  webServer: {
    command: 'node bin/server.js',
    cwd: fileURLToPath(new URL('../apps/api/build', import.meta.url)),
    url: `${baseURL}/api/health/live`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
