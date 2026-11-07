import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkSwitchComponent } from './switch.component'

@Component({
  imports: [MkSwitchComponent],
  template: `
    <mk-switch
      [checked]="checked()"
      [disabled]="disabled()"
      (checkedChange)="asked.set($event)"
      testId="probe.switch"
    >
      Notifications
    </mk-switch>
  `,
})
class Host {
  readonly checked = signal(false)
  readonly disabled = signal(false)
  readonly asked = signal<boolean | null>(null)
}

describe('mk-switch', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    return {
      fixture,
      host,
      control: () => host.querySelector<HTMLButtonElement>('[data-testid="probe.switch"]')!,
    }
  }

  it('is a labelled switch that reflects the owner state', () => {
    const { fixture, control } = render()

    expect(control().getAttribute('role')).toBe('switch')
    expect(control().getAttribute('aria-checked')).toBe('false')
    expect(control().textContent).toContain('Notifications')

    fixture.componentInstance.checked.set(true)
    fixture.detectChanges()
    expect(control().getAttribute('aria-checked')).toBe('true')
  })

  it('a tap asks for the other state and changes nothing by itself', () => {
    const { fixture, control } = render()

    control().click()
    fixture.detectChanges()

    expect(fixture.componentInstance.asked()).toBe(true)
    expect(control().getAttribute('aria-checked')).toBe('false')
  })

  it('disabled takes no taps', () => {
    const { fixture, control } = render()
    fixture.componentInstance.disabled.set(true)
    fixture.detectChanges()

    control().click()

    expect(control().disabled).toBe(true)
    expect(fixture.componentInstance.asked()).toBeNull()
  })
})
