import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkRouteChipComponent } from './route-chip.component'

@Component({
  imports: [MkRouteChipComponent],
  template: `
    <mk-route-chip [stops]="['PVM', 'ALD', 'KSB']" data-testid="probe.trip" />
    <mk-route-chip [stops]="['PVM', 'ALD']" size="display" data-testid="probe.ticket" />
  `,
})
class Host {}

describe('mk-route-chip', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('strings the codes with arrows the screen reader skips', () => {
    const host = render()
    const chip = host.querySelector('[data-testid="probe.trip"]')!

    expect(chip.textContent?.replace(/\s+/g, ' ').trim()).toBe('PVM → ALD → KSB')
    expect(chip.querySelectorAll('.mk-route__arrow[aria-hidden="true"]')).toHaveLength(2)
    expect(chip.getAttribute('data-size')).toBe('label')
  })

  it('the ticket stub takes the display size', () => {
    const host = render()

    expect(host.querySelector('[data-testid="probe.ticket"]')?.getAttribute('data-size')).toBe(
      'display'
    )
  })
})
