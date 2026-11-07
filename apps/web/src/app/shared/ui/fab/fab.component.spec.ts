import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkIconComponent } from '../icon/icon.component'
import { MkFabComponent } from './fab.component'

@Component({
  imports: [MkFabComponent, MkIconComponent],
  template: `
    <button mk-fab type="button" data-testid="probe.fab"><mk-icon name="plus" />Expense</button>
    <a mk-fab placement="static" href="/t/demo/add" data-testid="probe.static">Expense</a>
  `,
})
class Host {}

describe('mk-fab', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('is a native button that floats by default', () => {
    const host = render()
    const fab = host.querySelector('[data-testid="probe.fab"]')!

    expect(fab.tagName).toBe('BUTTON')
    expect(fab.getAttribute('data-placement')).toBe('fixed')
    expect(fab.textContent?.trim()).toBe('Expense')
    expect(fab.querySelector('mk-icon')).not.toBeNull()
  })

  it('can sit in the flow for the style guide', () => {
    const host = render()

    expect(host.querySelector('[data-testid="probe.static"]')?.getAttribute('data-placement')).toBe(
      'static'
    )
  })
})
