import type { ApplicationService } from '@adonisjs/core/types'
import { LlmProvider } from '#services/llm/llm_provider'

/**
 * Binds the `LlmProvider` implementation chosen by `LLM_PROVIDER` (default
 * `fake`). Resolved lazily so the env is validated first and tests can
 * swap the binding with a configured fake.
 */
export default class LlmServiceProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(LlmProvider, async () => {
      const { default: env } = await import('#start/env')
      switch (env.get('LLM_PROVIDER')) {
        case 'anthropic': {
          const { AnthropicCompatibleProvider } =
            await import('#services/llm/anthropic_compatible_provider')
          return new AnthropicCompatibleProvider({
            baseUrl: env.get('LLM_BASE_URL'),
            apiKey: env.get('LLM_API_KEY')?.release() ?? '',
            model: env.get('LLM_MODEL') ?? '',
            visionModel: env.get('LLM_VISION_MODEL') || undefined,
          })
        }
        case 'openai': {
          const { OpenAiCompatibleProvider } =
            await import('#services/llm/openai_compatible_provider')
          return new OpenAiCompatibleProvider()
        }
        default: {
          const { FakeLlmProvider } = await import('#services/llm/fake_llm_provider')
          return new FakeLlmProvider(this.app.makePath('tests/fixtures/llm'))
        }
      }
    })
  }
}
