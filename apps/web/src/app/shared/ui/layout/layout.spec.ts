import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkPageComponent } from './page.component'
import { MkRowComponent, MkRowGrowDirective } from './row.component'
import { MkSectionComponent } from './section.component'
import { MkStackComponent } from './stack.component'

@Component({
  imports: [
    MkPageComponent,
    MkSectionComponent,
    MkStackComponent,
    MkRowComponent,
    MkRowGrowDirective,
  ],
  template: `
    <mk-page [tabBar]="true">
      <mk-section eyebrow="Next" data-testid="probe.first">
        <mk-stack gap="2" align="center"><span>a</span></mk-stack>
      </mk-section>
      <mk-section title="Tonight" data-testid="probe.second">
        <mk-row gap="half" justify="between" [wrap]="true"><span mkRowGrow>b</span></mk-row>
      </mk-section>
      <mk-section [hairline]="false" data-testid="probe.third" />
    </mk-page>
  `,
})
class Host {}

@Component({
  imports: [MkPageComponent],
  template: `<mk-page [tabBar]="true" [fab]="true"><p>Left today</p></mk-page>`,
})
class FabHost {}

/** The text of every style element the mounted components added to the document. */
function mountedCss(): string {
  return [...document.querySelectorAll('style')].map((style) => style.textContent ?? '').join('\n')
}

describe('layout primitives', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('mk-page marks itself for the tab bar padding', () => {
    const host = render()

    expect(host.querySelector('mk-page')?.hasAttribute('data-tab-bar')).toBe(true)
  })

  it('page reserves clearance for the floating action', () => {
    TestBed.configureTestingModule({ imports: [FabHost] })
    const fixture = TestBed.createComponent(FabHost)
    fixture.detectChanges()
    const page = (fixture.nativeElement as HTMLElement).querySelector('mk-page')!

    expect(page.hasAttribute('data-fab')).toBe(true)
    // The bottom padding of a page with a FAB adds the FAB's clearance to the tab bar's room.
    const fabRule = /\[data-fab\][^{]*\{([^}]*)\}/.exec(mountedCss())?.[1] ?? ''
    expect(fabRule).toMatch(/padding-bottom:[^;]*var\(--fab-clearance\)/)
    expect(fabRule).toMatch(/padding-bottom:[^;]*var\(--tab-bar-height\)/)
    // The clearance is the FAB's own height (space-6) plus the 16 px gap above it.
    const tokens = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')
    expect(tokens).toMatch(/--fab-clearance:\s*calc\(var\(--space-6\) \+ var\(--space-2\)\)/)
  })

  it('a page without a FAB keeps no clearance for one', () => {
    const host = render()

    expect(host.querySelector('mk-page')?.hasAttribute('data-fab')).toBe(false)
  })

  it('mk-section renders a mono eyebrow or a heading title and opts out of its hairline', () => {
    const host = render()
    const first = host.querySelector('[data-testid="probe.first"]')!
    const second = host.querySelector('[data-testid="probe.second"]')!
    const third = host.querySelector('[data-testid="probe.third"]')!

    expect(first.querySelector('.mk-type-eyebrow')?.textContent).toBe('Next')
    expect(first.querySelector('h2')).toBeNull()
    expect(second.querySelector('h2')?.textContent).toBe('Tonight')
    expect(second.querySelector('h2')?.classList.contains('mk-type-heading')).toBe(true)
    expect(second.hasAttribute('data-hairline')).toBe(true)
    expect(third.hasAttribute('data-hairline')).toBe(false)
  })

  it('mk-stack and mk-row expose their gap and alignment as data attributes for the token styles', () => {
    const host = render()
    const stack = host.querySelector('mk-stack')!
    const row = host.querySelector('mk-row')!

    expect(stack.getAttribute('data-gap')).toBe('2')
    expect(stack.getAttribute('data-align')).toBe('center')
    expect(row.getAttribute('data-gap')).toBe('half')
    expect(row.getAttribute('data-justify')).toBe('between')
    expect(row.hasAttribute('data-wrap')).toBe(true)
    expect(row.querySelector('[mkRowGrow]')?.classList.contains('mk-grow')).toBe(true)
  })
})
