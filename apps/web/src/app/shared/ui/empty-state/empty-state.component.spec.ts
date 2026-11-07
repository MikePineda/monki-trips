import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkEmptyStateComponent } from './empty-state.component'

@Component({
  imports: [MkEmptyStateComponent],
  template: `
    <mk-empty-state title="No trips yet" body="Trips you plan will show up here." icon="plane">
      <button mkEmptyAction type="button">Create a trip</button>
    </mk-empty-state>
  `,
})
class WithAction {}

@Component({
  imports: [MkEmptyStateComponent],
  template: `
    <mk-empty-state title="Nothing here">
      <span mkEmptyIcon data-testid="probe.mascot">mascot</span>
    </mk-empty-state>
  `,
})
class WithMascot {}

@Component({
  imports: [MkEmptyStateComponent],
  template: `<mk-empty-state title="Nothing today" mascot="happy" mascotSize="sm" />`,
})
class WithSmallKiko {}

describe('mk-empty-state', () => {
  function render<T>(host: new () => T): HTMLElement {
    TestBed.configureTestingModule({ imports: [host] })
    const fixture = TestBed.createComponent(host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('shows the icon, the title, the body and the one action', () => {
    const host = render(WithAction)

    expect(host.querySelector('h2')?.textContent).toBe('No trips yet')
    expect(host.querySelector('p')?.textContent).toBe('Trips you plan will show up here.')
    expect(host.querySelector('mk-icon use')?.getAttribute('href')).toBe('sprite/lucide.svg#plane')
    expect(host.querySelector('.mk-empty-state__action button')?.textContent).toBe('Create a trip')
  })

  it('a projected illustration replaces the icon and the body is optional', () => {
    const host = render(WithMascot)

    expect(host.querySelector('[data-testid="probe.mascot"]')).not.toBeNull()
    expect(host.querySelector('mk-icon')).toBeNull()
    expect(host.querySelector('p')).toBeNull()
  })

  it('draws Kiko in the asked state, small inside a screen section', () => {
    const mascot = render(WithSmallKiko).querySelector('mk-mascot')

    expect(mascot?.getAttribute('data-state')).toBe('happy')
    expect(mascot?.getAttribute('data-size')).toBe('sm')
  })
})
