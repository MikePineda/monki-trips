import { Dialog } from '@angular/cdk/dialog'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TestBed } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { i18nTesting } from '../../../testing/i18n-testing'
import { MASCOT_STATES } from '../../shared/ui/mascot/mascot-sheet'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { COLOR_TOKENS } from './design-tokens'
import StyleguidePage from './styleguide.page'

describe('StyleguidePage', () => {
  beforeEach(() => {
    localStorage.clear()
    document.head.querySelector('meta[name="robots"]')?.remove()
    TestBed.configureTestingModule({
      imports: [StyleguidePage, i18nTesting()],
      providers: [provideRouter([])],
    })
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

  it('renders one swatch per colour token of tokens.json, in groups', () => {
    const { host } = render()
    const json = JSON.parse(
      readFileSync(join(process.cwd(), '../../docs/design/tokens.json'), 'utf8')
    ) as { color: { tokens: { name: string }[] } }

    const swatches = [...host.querySelectorAll('mk-swatch')].map((element) =>
      element.getAttribute('data-token')
    )
    expect(swatches).toEqual([...COLOR_TOKENS])
    expect([...swatches].sort()).toEqual(json.color.tokens.map((token) => token.name).sort())
  })

  it('shows a specimen of every type style', () => {
    const { host } = render()
    const specimens = [
      ...host.querySelectorAll('[data-testid="styleguide.typography"] [data-variant]'),
    ]

    expect(specimens.map((element) => element.getAttribute('data-variant'))).toEqual([
      'display',
      'title',
      'heading',
      'body',
      'body-strong',
      'label',
      'caption',
      'code-display',
      'code',
      'code-label',
      'eyebrow',
    ])
    expect(specimens[0].classList.contains('mk-type-display')).toBe(true)
  })

  it('shows every ui-kit component in its states', () => {
    const { host } = render()
    const section = (id: string) => host.querySelector(`[data-testid="styleguide.${id}"]`)!

    expect(section('buttons').querySelectorAll('[mk-button]').length).toBeGreaterThanOrEqual(8)
    expect(section('icon-buttons').querySelectorAll('[mk-icon-button]')).toHaveLength(3)
    expect(section('chips').querySelectorAll('mk-chip')).toHaveLength(6)
    expect(section('route-chips').querySelectorAll('mk-route-chip')).toHaveLength(3)
    expect(section('fields').querySelectorAll('mk-field')).toHaveLength(3)
    expect(section('rows').querySelectorAll('mk-list-row')).toHaveLength(3)
    expect(section('event-rows').querySelectorAll('mk-event-row')).toHaveLength(2)
    expect(section('ticket').querySelector('mk-ticket mask')).not.toBeNull()
    expect(section('segmented').querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(section('stats').querySelectorAll('mk-stat-tile')).toHaveLength(3)
    expect(
      [...section('banners').querySelectorAll('mk-banner')].map((b) => b.getAttribute('data-tone'))
    ).toEqual(['print', 'saved', 'critical'])
    expect(section('progress').querySelectorAll('mk-progress')).toHaveLength(2)
    expect(section('tab-bar').querySelectorAll('mk-tab-bar a')).toHaveLength(5)
    expect(section('fab').querySelector('[mk-fab]')?.getAttribute('data-placement')).toBe('static')
    expect(section('connection').querySelectorAll('mk-connection-status')).toHaveLength(5)
    expect(section('empty').querySelectorAll('mk-empty-state')).toHaveLength(3)
    expect(section('skeleton').querySelector('mk-skeleton')).not.toBeNull()
    expect(section('keypad').querySelectorAll('mk-keypad button')).toHaveLength(12)
    expect(section('icons').querySelectorAll('mk-icon').length).toBeGreaterThan(40)
  })

  it('shows Kiko in the six states at the three sizes with a reduced-motion toggle', () => {
    const { fixture, host } = render()
    const mascot = host.querySelector('[data-testid="styleguide.mascot"]')!

    for (const state of MASCOT_STATES) {
      const row = mascot.querySelector(`[data-testid="styleguide.mascot.${state}"]`)!
      const sizes = [...row.querySelectorAll('mk-mascot')].map((m) => m.getAttribute('data-size'))
      expect(sizes, state).toEqual(['sm', 'md', 'lg'])
      expect(row.querySelector('mk-mascot')?.getAttribute('data-motion')).toBe('animated')
    }

    mascot.querySelector<HTMLElement>('[data-testid="styleguide.mascot.still"] button')!.click()
    fixture.detectChanges()

    for (const element of mascot.querySelectorAll('mk-mascot')) {
      expect(element.getAttribute('data-motion')).toBe('still')
    }
  })

  it('shows the two sample stamps, a generated one and one not reached yet', () => {
    const { host } = render()
    const stamps = [...host.querySelectorAll('[data-testid="styleguide.stamps"] mk-stamp')].filter(
      (stamp) => !stamp.closest('[data-testid="styleguide.stampSheet"]')
    )

    expect(stamps.map((stamp) => stamp.getAttribute('data-code'))).toEqual(['XA', 'XB', 'ZZ', 'XB'])
    expect(stamps.map((stamp) => stamp.getAttribute('data-artwork'))).toEqual([
      'XA',
      'XB',
      null,
      null,
    ])
    expect(stamps[3].hasAttribute('data-reached')).toBe(false)
  })

  it('shows a sheet of twelve generated stamps for invented places, in every shape', () => {
    const { host } = render()
    const sheet = [...host.querySelectorAll('[data-testid="styleguide.stampSheet"] mk-stamp')]

    expect(sheet).toHaveLength(12)
    expect(sheet.every((stamp) => !stamp.hasAttribute('data-artwork'))).toBe(true)
    expect(new Set(sheet.map((stamp) => stamp.getAttribute('data-shape')))).toEqual(
      new Set(['circle', 'rounded', 'octagon', 'oval'])
    )
  })

  it('builds the four mock screens from the real components with synthetic data', () => {
    const { host } = render()
    const mock = (id: string) => host.querySelector(`[data-testid="styleguide.mock.${id}"]`)!

    expect(mock('today').querySelector('mk-device-frame mk-ticket')).not.toBeNull()
    expect(mock('today').querySelector('mk-banner[data-tone="print"]')).not.toBeNull()
    expect(mock('today').querySelector('mk-mascot[data-size="sm"]')).not.toBeNull()
    expect(mock('today').querySelector('[mk-fab]')).not.toBeNull()
    expect(mock('today').textContent).toContain('Day 4 of 12 · Port Vellmar')
    expect(mock('trips').querySelectorAll('mk-list-row')).toHaveLength(3)
    expect(mock('trips').querySelectorAll('mk-stamp')).toHaveLength(2)
    expect(mock('day').querySelectorAll('mk-event-row')).toHaveLength(4)
    expect(mock('day').querySelectorAll('mk-route-chip')).toHaveLength(2)
    expect(mock('day').querySelector('mk-empty-state[data-layout="compact"]')).not.toBeNull()
    expect(mock('expense').querySelector('mk-sheet mk-keypad')).not.toBeNull()
    expect(
      mock('expense').querySelector('[data-testid="styleguide.expense.amount"]')?.textContent
    ).toBe('€18.40')
    expect(host.textContent).not.toMatch(/styleguide\.|shell\.|ui\./)
  })

  it('switching the language re-renders without raw keys', () => {
    const { fixture, host } = render()

    host.querySelector<HTMLElement>('[data-testid="styleguide.lang.es"]')!.click()
    fixture.detectChanges()

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Guía de estilo')
    expect(host.textContent).not.toMatch(/styleguide\.|shell\.|ui\./)
    expect(host.querySelector('[data-testid="styleguide.mock.today"]')?.textContent).toContain(
      'Día 4 de 12'
    )
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

  it('shows a phrase card full screen and closes it', () => {
    const { fixture, host } = render()

    host.querySelector<HTMLElement>('[data-testid="styleguide.show-card"]')!.click()
    fixture.detectChanges()
    expect(
      host.querySelector('mk-show-card [data-testid="ui.showCard.phrase"]')?.textContent
    ).toContain('stacidomo')

    host.querySelector<HTMLElement>('[data-testid="ui.showCard.close"]')!.click()
    fixture.detectChanges()
    expect(host.querySelector('mk-show-card')).toBeNull()
  })

  it('tells search engines not to index it', () => {
    render()

    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex'
    )
  })
})
