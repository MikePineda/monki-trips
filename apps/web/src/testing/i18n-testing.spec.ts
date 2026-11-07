import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TestBed } from '@angular/core/testing'
import { TranslocoService } from '@jsverse/transloco'
import { firstValueFrom } from 'rxjs'
import { i18nTesting } from './i18n-testing'
import { SCOPE_CATALOGUES } from './i18n-scopes'

/** Every scope name declared through provideTranslocoScope() in the app's sources. */
function declaredScopes(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? walk(path) : [path]
    })
  const declaration = /provideTranslocoScope\(\s*(?:\{\s*scope:\s*)?'([^']+)'/g
  const names = walk(join(process.cwd(), 'src/app'))
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.spec.ts'))
    .flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(declaration)].map((match) => match[1])
    )
  return [...new Set(names)].sort()
}

describe('i18nTesting', () => {
  function setup(): TranslocoService {
    TestBed.configureTestingModule({ imports: [i18nTesting()] })
    return TestBed.inject(TranslocoService)
  }

  it('every scope the app declares is registered for preloading', () => {
    expect(Object.keys(SCOPE_CATALOGUES).sort()).toEqual(declaredScopes())
  })

  it('a scope that is not preloaded fails instead of loading lazily', async () => {
    const transloco = setup()
    const lazy = vi.fn(async () => ({ title: 'Too late' }))

    await expect(
      firstValueFrom(
        transloco.load('unregistered/en', { inlineLoader: { 'unregistered/en': lazy } })
      )
    ).rejects.toThrow(/"unregistered\/en" is not preloaded/)
    expect(lazy).not.toHaveBeenCalled()
  })

  it('a missing key throws instead of rendering the raw key', () => {
    const transloco = setup()

    expect(() => transloco.translate('nowhere.to.be.found')).toThrow(
      /Missing translation for "nowhere\.to\.be\.found"/
    )
  })
})
