import { inject } from '@adonisjs/core'
import type { ApiEnvelope, AppConfig } from '@monkitrips/shared'
import { LOCALES } from '@monkitrips/shared'
import i18nManager from '@adonisjs/i18n/services/main'
import { currentBuildInfo } from '#services/build_info'
import { RegistrationPolicy } from '#services/registration_policy'
import { VapidConfig } from '#services/vapid_config'

/**
 * Public configuration the web app reads before anyone signs in. Being a
 * GET through the shield middleware, it also hands out the XSRF-TOKEN cookie
 * the first mutating request needs. The VAPID public key is public by
 * design: browsers subscribe with it.
 */
@inject()
export default class ConfigController {
  constructor(
    private readonly registration: RegistrationPolicy,
    private readonly vapid: VapidConfig
  ) {}

  async show(): Promise<ApiEnvelope<AppConfig>> {
    const build = await currentBuildInfo()
    return {
      data: {
        registrationOpen: this.registration.isOpen(),
        locales: LOCALES,
        defaultLocale: i18nManager.defaultLocale as AppConfig['defaultLocale'],
        version: build.version,
        pushEnabled: this.vapid.enabled,
        vapidPublicKey: this.vapid.publicKey,
      },
    }
  }
}
