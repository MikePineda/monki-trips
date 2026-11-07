import app from '@adonisjs/core/services/app'
import type { Group } from '@japa/runner/core'
import { FakeLlmProvider } from '#services/llm/fake_llm_provider'
import { LlmProvider } from '#services/llm/llm_provider'

/** A fake provider reading `tests/fixtures/llm`, fresh for every test of the group. */
export function useFakeLlm(group: Group): { current: FakeLlmProvider } {
  const holder = { current: new FakeLlmProvider(app.makePath('tests/fixtures/llm')) }
  group.each.setup(() => {
    holder.current = new FakeLlmProvider(app.makePath('tests/fixtures/llm'))
    app.container.swap(LlmProvider, () => holder.current)
    return () => app.container.restore(LlmProvider)
  })
  return holder
}
