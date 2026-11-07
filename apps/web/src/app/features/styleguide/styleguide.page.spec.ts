import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../testing/i18n-testing'
import { COLOR_TOKENS } from './design-tokens'
import StyleguidePage from './styleguide.page'

describe('StyleguidePage', () => {
  it('renders one swatch per colour token', () => {
    TestBed.configureTestingModule({ imports: [StyleguidePage, i18nTesting()] })
    const fixture = TestBed.createComponent(StyleguidePage)
    fixture.detectChanges()

    const swatches = [...fixture.nativeElement.querySelectorAll('[data-token]')].map(
      (element) => (element as HTMLElement).dataset['token']
    )
    expect(swatches).toEqual([...COLOR_TOKENS])
  })

  it('every listed token is defined in styles.css for light and dark', () => {
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')
    // Split at the dark rule itself (line start), not at mentions in comments.
    const blocks = styles.split(/^\[data-theme=['"]dark['"]\]\s*\{/m)

    expect(blocks).toHaveLength(2)
    for (const token of COLOR_TOKENS) {
      expect(blocks[0], token).toMatch(new RegExp(`--${token}:`))
      expect(blocks[1], token).toMatch(new RegExp(`--${token}:`))
    }
  })
})
