import app from '@adonisjs/core/services/app'
import type { Group } from '@japa/runner/core'
import { generateVAPIDKeys } from 'web-push'
import { FakePushSender } from '#services/fake_push_sender'
import { PushSender } from '#services/push_sender'
import { VapidConfig } from '#services/vapid_config'

/**
 * A complete VAPID configuration with a pair generated for this run. The
 * test env files leave `VAPID_*` empty: no private key is ever committed,
 * so specs that need push enabled build their keys here, at runtime.
 */
export function makeVapidConfig(): VapidConfig {
  const { publicKey, privateKey } = generateVAPIDKeys()
  return new VapidConfig(publicKey, privateKey, 'mailto:push@example.com')
}

/** The configuration `usePushEnabled` swapped in for the running test, if any. */
let enabledVapid: VapidConfig | null = null

/**
 * Push enabled for every test of the group, the way a deployment with keys
 * boots: `VapidConfig` is swapped for a runtime-generated pair (returned,
 * so a spec can compare against it).
 */
export function usePushEnabled(group: Group): VapidConfig {
  const vapid = makeVapidConfig()
  group.each.setup(() => {
    enabledVapid = vapid
    app.container.swap(VapidConfig, () => vapid)
    return () => {
      enabledVapid = null
      app.container.restore(VapidConfig)
    }
  })
  return vapid
}

/**
 * `Push::fake()`: push enabled with a runtime-generated pair (see
 * `usePushEnabled`) and the recording `FakePushSender` the container already
 * binds under `NODE_ENV=test`, reset before every test of the group.
 */
export function useFakePushSender(group: Group): FakePushSender {
  usePushEnabled(group)
  const fake = new FakePushSender()
  group.each.setup(() => {
    fake.reset()
    app.container.swap(PushSender, () => fake)
    return () => app.container.restore(PushSender)
  })
  return fake
}

/** Runs `work` with push disabled (no VAPID keys), the way a deployment without keys boots. */
export async function withPushDisabled<T>(work: () => Promise<T>): Promise<T> {
  const previous = enabledVapid
  app.container.swap(VapidConfig, () => VapidConfig.disabled())
  try {
    return await work()
  } finally {
    if (previous) {
      app.container.swap(VapidConfig, () => previous)
    } else {
      app.container.restore(VapidConfig)
    }
  }
}
