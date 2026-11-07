import { generateVAPIDKeys } from 'web-push'

/**
 * Fills `VAPID_*` in this process's environment with a pair generated for
 * the run, unless a complete set is already there. e2e/e2e.env leaves them
 * empty (no private key is ever committed); the API started by Playwright's
 * `webServer` inherits these variables, so `/config` reports push enabled
 * and the browser gets a real P-256 public key. Workers inherit the same
 * environment, so loading the config again keeps the run's pair.
 *
 * It runs from playwright.config.ts because the `webServer` starts before
 * `globalSetup`.
 */
export function ensureVapidKeys(env: NodeJS.ProcessEnv = process.env): void {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT) {
    return
  }
  const { publicKey, privateKey } = generateVAPIDKeys()
  env.VAPID_PUBLIC_KEY = publicKey
  env.VAPID_PRIVATE_KEY = privateKey
  env.VAPID_SUBJECT = 'mailto:push@example.com'
}
