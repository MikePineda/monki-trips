import { Dialog } from '@angular/cdk/dialog'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../testing/i18n-testing'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { COLOR_TOKENS } from './design-tokens'
import StyleguidePage from './styleguide.page'

describe('StyleguidePage', () => {
  beforeEach(() => {
    localStorage.clear()
    document.head.querySelector('meta[name="robots"]')?.remove()
    TestBed.configureTestingModule({ imports: [StyleguidePage, i18nTesting()] })
  })

  afterEach(() => {
    TestBed.inject(Dialog).closeAll()
    document.documentElement.removeAttribute('data-theme')
  })

  function render() {
    const fixture = TestBed.createComponent(StyleguidePage)
    fixture.detectChanges()
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  it('renders one swatch per colour token', () => {
    const { host } = render()

    const swatches = [...host.querySelectorAll('[data-token]')].map(
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

  it('shows every component in both themes side by side', () => {
    const { host } = render()

    for (const theme of ['light', 'dark']) {
      const panel = host.querySelector(`[data-testid="styleguide.theme-panel.${theme}"]`)
      expect(panel?.getAttribute('data-theme')).toBe(theme)
      expect(panel?.querySelectorAll('[mk-button]').length).toBeGreaterThanOrEqual(5)
      expect(panel?.querySelectorAll('mk-chip')).toHaveLength(4)
      expect(panel?.querySelectorAll('mk-field')).toHaveLength(2)
      expect(panel?.querySelectorAll('mk-connection-status')).toHaveLength(5)
      expect(panel?.querySelector('mk-skeleton')).not.toBeNull()
      expect(panel?.querySelector('mk-empty-state')).not.toBeNull()
      expect(panel?.querySelectorAll('mk-icon').length).toBeGreaterThan(30)
    }
  })

  it('keeps an empty slot for the mascot of WP 0.7', () => {
    const { host } = render()

    expect(host.querySelector('[data-testid="styleguide.mascot"]')?.textContent).toContain(
      'design system'
    )
  })

  it('switching the language re-renders without raw keys', () => {
    const { fixture, host } = render()

    host.querySelector<HTMLElement>('[data-testid="styleguide.lang.es"]')!.click()
    fixture.detectChanges()

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Guía de estilo')
    expect(host.textContent).not.toMatch(/shell\.styleguide\./)
  })

  it('the theme switch flips data-theme on the document', () => {
    const { host } = render()

    host.querySelector<HTMLElement>('[data-testid="styleguide.theme.dark"]')!.click()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('opens the sample sheet and shows the undo toast', () => {
    const { fixture, host } = render()

    host.querySelector<HTMLElement>('[data-testid="styleguide.open-sheet"]')!.click()
    TestBed.tick()
    expect(
      document.querySelector('.cdk-overlay-container [data-testid="styleguide.sheet.body"]')
    ).not.toBeNull()

    host.querySelector<HTMLElement>('[data-testid="styleguide.show-toast"]')!.click()
    fixture.detectChanges()
    const toasts = TestBed.inject(ToastService)
    expect(toasts.toasts()[0]?.message).toBe('Expense saved')
  })

  it('tells search engines not to index it', () => {
    render()

    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex'
    )
  })
})
