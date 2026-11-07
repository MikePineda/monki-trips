import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MkCallRowComponent } from './call-row.component'

@Component({
  imports: [MkCallRowComponent],
  template: ` <mk-call-row name="Assistance" [phone]="phone()" note="24 h" testId="probe.call" /> `,
})
class Host {
  readonly phone = signal('+1 555 0100')
}

describe('mk-call-row', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Host] })
    const fixture = TestBed.createComponent(Host)
    fixture.detectChanges()
    return { fixture, host: fixture.nativeElement as HTMLElement }
  }

  it('phone numbers render as tel links, with the name and note around them', () => {
    const { host } = render()
    const link = host.querySelector<HTMLAnchorElement>('[data-testid="probe.call.link"]')!

    expect(link.getAttribute('href')).toBe('tel:+15550100')
    expect(link.textContent).toContain('Assistance')
    expect(link.textContent).toContain('+1 555 0100')
    expect(link.textContent).toContain('24 h')
  })

  it('a value with nothing to dial is shown but not linked', () => {
    const { fixture, host } = render()
    fixture.componentInstance.phone.set('ask at reception')
    fixture.detectChanges()

    expect(host.querySelector('a')).toBeNull()
    expect(host.textContent).toContain('ask at reception')
  })
})
