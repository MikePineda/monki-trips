import { Component, input, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkSegmentedComponent, type SegmentedRole } from './segmented.component'

@Component({
  imports: [MkSegmentedComponent],
  template: `
    <mk-segmented
      [options]="[
        { id: 'days', label: 'Days' },
        { id: 'stays', label: 'Where we sleep' },
      ]"
      [(value)]="value"
      [role]="role()"
      label="View"
      testId="probe.view"
    />
  `,
})
class Host {
  readonly value = signal('days')
  readonly role = input<SegmentedRole>('radiogroup')
}

describe('mk-segmented', () => {
  function render(role: SegmentedRole = 'radiogroup') {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.componentRef.setInput('role', role)
    fixture.detectChanges()
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  it('is a labelled radiogroup whose checked option is the value', () => {
    const { host } = render()
    const track = host.querySelector('[role="radiogroup"]')!

    expect(track.getAttribute('aria-label')).toBe('View')
    expect(
      host.querySelector('[data-testid="probe.view.days"]')?.getAttribute('aria-checked')
    ).toBe('true')
    expect(
      host.querySelector('[data-testid="probe.view.stays"]')?.getAttribute('aria-checked')
    ).toBe('false')
  })

  it('tapping an option sets the value and moves the checked state', () => {
    const { fixture, host } = render()

    host.querySelector<HTMLElement>('[data-testid="probe.view.stays"]')!.click()
    fixture.detectChanges()

    expect(fixture.componentInstance.value()).toBe('stays')
    expect(
      host.querySelector('[data-testid="probe.view.stays"]')?.getAttribute('aria-checked')
    ).toBe('true')
  })

  it('as a tablist it uses tab roles and aria-selected', () => {
    const { host } = render('tablist')

    expect(host.querySelector('[role="tablist"]')).not.toBeNull()
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(
      host.querySelector('[data-testid="probe.view.days"]')?.getAttribute('aria-selected')
    ).toBe('true')
    expect(
      host.querySelector('[data-testid="probe.view.days"]')?.hasAttribute('aria-checked')
    ).toBe(false)
  })
})
