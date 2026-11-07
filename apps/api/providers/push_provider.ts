import type { ApplicationService } from '@adonisjs/core/types'
import { PushSender } from '#services/push_sender'
import { VapidConfig } from '#services/vapid_config'

/**
 * Binds the deployment's VAPID identity and the `PushSender` it implies:
 * the real `web-push` sender with complete keys outside tests, otherwise
 * the recording fake. Resolved lazily so the env is validated first and
 * specs can swap either binding.
 */
export default class PushProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(VapidConfig, async () => {
      const { default: env } = await import('#start/env')
      return new VapidConfig(
        env.get('VAPID_PUBLIC_KEY') ?? null,
        env.get('VAPID_PRIVATE_KEY')?.release() ?? null,
        env.get('VAPID_SUBJECT') ?? null
      )
    })

    this.app.container.singleton(PushSender, async () => {
      const vapid = await this.app.container.make(VapidConfig)
      if (!vapid.enabled || this.app.inTest) {
        const { FakePushSender } = await import('#services/fake_push_sender')
        return new FakePushSender()
      }
      const { WebPushSender } = await import('#services/web_push_sender')
      return new WebPushSender(vapid)
    })
  }
}
