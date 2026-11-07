import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkCheckRowComponent } from './check-row.component'

@Component({
  imports: [MkCheckRowComponent],
  template: `
    <mk-check-row
      title="Buy an adapter"
      meta="Due Sat 1 Mar"
      [checked]="checked()"
      [pending]="pending()"
      (checkedChange)="asked.set($event)"
      testId="probe.row"
    >
      <span mkRowTrailing>action</span>
    </mk-check-row>
  `,
})
class Host {
  readonly checked = signal(false)
  readonly pending = signal(false)
  readonly asked = signal<boolean | null>(null)
}

describe('mk-check-row', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      row: () => host.querySelector<HTMLElement>('[data-testid="probe.row"]')!,
      toggle: () => host.querySelector<HTMLButtonElement>('[data-testid="probe.row.toggle"]')!,
    }
  }

  it('is a checkbox named after the title that reflects the owner state', () => {
    const { fixture, toggle, row } = render()

    expect(toggle().getAttribute('role')).toBe('checkbox')
    expect(toggle().getAttribute('aria-checked')).toBe('false')
    expect(toggle().getAttribute('aria-label')).toBe('Buy an adapter')
    expect(row().textContent).toContain('Due Sat 1 Mar')
    expect(row().textContent).toContain('action')

    fixture.componentInstance.checked.set(true)
    fixture.detectChanges()
    expect(toggle().getAttribute('aria-checked')).toBe('true')
    expect(row().hasAttribute('data-checked')).toBe(true)
  })

  it('a tap asks for the other state and changes nothing by itself', () => {
    const { fixture, toggle } = render()

    toggle().click()
    fixture.detectChanges()

    expect(fixture.componentInstance.asked()).toBe(true)
    expect(toggle().getAttribute('aria-checked')).toBe('false')
  })

  it('says pending while the change waits for the server', () => {
    const { fixture, host, row } = render()
    expect(host.querySelector('[data-testid="ui.checkRow.pending"]')).toBeNull()

    fixture.componentInstance.pending.set(true)
    fixture.detectChanges()

    expect(row().hasAttribute('data-pending')).toBe(true)
    expect(host.querySelector('[data-testid="ui.checkRow.pending"]')?.textContent).toContain(
      'pending'
    )
  })
})
