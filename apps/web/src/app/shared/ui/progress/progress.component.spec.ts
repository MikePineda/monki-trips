import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkProgressComponent } from './progress.component'

@Component({
  imports: [MkProgressComponent],
  template: `
    <mk-progress label="Documents saved offline" [value]="12" [max]="18" data-testid="probe.bar" />
    <mk-progress
      label="Ready to fly"
      [value]="5"
      [max]="7"
      variant="steps"
      data-testid="probe.steps"
    />
  `,
})
class Host {}

describe('mk-progress', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host, i18nTesting()] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('is a progressbar that writes its count next to the label', () => {
    const host = render()
    const bar = host.querySelector('[data-testid="probe.bar"]')!
    const track = bar.querySelector('[role="progressbar"]')!

    expect(track.getAttribute('aria-valuenow')).toBe('12')
    expect(track.getAttribute('aria-valuemax')).toBe('18')
    expect(track.getAttribute('aria-label')).toBe('Documents saved offline')
    expect(bar.querySelector('[data-testid="ui.progress.count"]')?.textContent).toBe('12 of 18')
    expect((bar.querySelector('.mk-progress__fill') as HTMLElement).style.width).toMatch(/^66\.6/)
  })

  it('the steps variant draws one segment per step, the done ones filled', () => {
    const host = render()
    const steps = host.querySelectorAll('[data-testid="probe.steps"] .mk-progress__step')

    expect(steps).toHaveLength(7)
    expect([...steps].filter((step) => step.hasAttribute('data-done'))).toHaveLength(5)
  })
})
