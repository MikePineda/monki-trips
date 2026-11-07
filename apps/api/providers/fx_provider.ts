import type { ApplicationService } from '@adonisjs/core/types'
import { FxRateProvider } from '#services/fx/fx_rate_provider'

/**
 * Binds the `FxRateProvider` implementation chosen by `FX_PROVIDER`
 * (default `fake`). Resolved lazily so the env is validated first and tests
 * can swap the binding.
 */
export default class FxProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(FxRateProvider, async () => {
      const { default: env } = await import('#start/env')
      if (env.get('FX_PROVIDER') === 'frankfurter') {
        const { FrankfurterProvider } = await import('#services/fx/frankfurter_provider')
        return new FrankfurterProvider()
      }
      const { FakeFxRateProvider } = await import('#services/fx/fake_fx_rate_provider')
      return new FakeFxRateProvider()
    })
  }
}
