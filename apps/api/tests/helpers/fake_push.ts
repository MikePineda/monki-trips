import app from '@adonisjs/core/services/app'
import type { Group } from '@japa/runner/core'
import { FakePushSender } from '#services/fake_push_sender'
import { PushSender } from '#services/push_sender'
import { VapidConfig } from '#services/vapid_config'

/**
 * `Push::fake()`: the container already binds a `FakePushSender` under
 * `NODE_ENV=test`; this returns it, reset before every test of the group.
 */
export function useFakePushSender(group: Group): FakePushSender {
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
  app.container.swap(VapidConfig, () => VapidConfig.disabled())
  try {
    return await work()
  } finally {
    app.container.restore(VapidConfig)
  }
}
